import fs from "node:fs";
import path from "node:path";
import { UserSecretKey, UserWallet, Mnemonic } from "@multiversx/sdk-wallet";
import chalk from "chalk";
import { Command } from "commander";
import { input, log } from "../_stdio";
import { Keystore } from "../world/signer";
import { computeShard, totalShards } from "../world/utils";
import { logError, logSuccess } from "./helpers";

export const registerNewWalletCmd = (cmd: Command) => {
  cmd
    .command("new-wallet")
    .description("Create a new wallet.")
    .requiredOption("--wallet <WALLET_PATH>", "Wallet path")
    .option("--password <PASSWORD>", "Wallet password")
    .option("--from-pem <PEM_PATH>", "PEM path")
    .option("--from-wallet <WALLET_PATH>", "Wallet path")
    .option("--shard <SHARD>", "Shard of the wallet")
    .action(action);
};

const action = async ({
  wallet: walletPath,
  password,
  fromPem: fromPemPath,
  fromWallet: fromWalletPath,
  shard,
}: {
  wallet: string;
  password?: string;
  fromPem?: string;
  fromWallet?: string;
  shard?: number;
}) => {
  walletPath = path.resolve(walletPath);
  if (fs.existsSync(walletPath)) {
    logError(`Wallet already exists at "${walletPath}".`);
    return;
  }
  if (password === undefined) {
    log(`Creating keystore wallet at "${walletPath}"...`);
    password = await input.hidden("Enter password: ");
    const passwordAgain = await input.hidden("Re-enter password: ");
    if (password !== passwordAgain) {
      logError("Passwords do not match.");
      return;
    }
    log();
  }
  let data;
  if (fromPemPath && fromWalletPath) {
    throw new Error(
      "Both --from-pem and --from-wallet options cannot be set simultaneously.",
    );
  }
  if (fromPemPath) {
    const secretKey = UserSecretKey.fromPem(
      fs.readFileSync(fromPemPath, "utf8"),
    );
    const wallet = UserWallet.fromSecretKey({ secretKey, password });
    data = wallet.toJSON();
  }
  if (fromWalletPath) {
    const oldKeystore = await Keystore.fromFile(fromWalletPath);
    const newWallet =
      oldKeystore.kind === "mnemonic"
        ? UserWallet.fromMnemonic({
            mnemonic: oldKeystore.getMnemonicWords().join(" "),
            password,
          })
        : UserWallet.fromSecretKey({
            secretKey: UserSecretKey.fromString(oldKeystore.getSecretKey()),
            password,
          });
    data = newWallet.toJSON();
  }
  if (data === undefined) {
    let mnemonic;
    if (shard === undefined) {
      mnemonic = Mnemonic.generate().toString();
    } else if (shard < 0 || shard >= totalShards) {
      logError("The shard you entered does not exist.");
      return;
    }

    while (!mnemonic) {
      const generatedMnemonic = Mnemonic.generate();
      const pubKey = generatedMnemonic
        .deriveKey()
        .generatePublicKey()
        .hex()
        .toString();

      const shardOfMnemonic = computeShard(pubKey);
      if (shardOfMnemonic == shard) {
        mnemonic = generatedMnemonic.toString();
      }
    }
    data = UserWallet.fromMnemonic({ mnemonic, password }).toJSON();
  }

  fs.writeFileSync(walletPath, JSON.stringify(data), "utf8");
  const keystore = new Keystore(data, password);
  const signer = keystore.newSigner();
  logSuccess(`Wallet created at "${walletPath}".`);
  log();
  log(chalk.bold.blue("Address:") + ` ${keystore.newSigner()}`);
  log();
  log(chalk.bold.blue("Shard:") + ` ${computeShard(signer.toTopHex())}`);
  if (keystore.kind === "mnemonic") {
    log();
    log(chalk.bold.blue("Private key:"));
    log(
      keystore
        .getMnemonicWords()
        .map((w, i) => `  ${i + 1}. ${w}`)
        .join("\n"),
    );
    log();
    log(chalk.bold.yellow("Please backup the private key in a secure place."));
  }
};
