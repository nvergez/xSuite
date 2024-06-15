import fs from "node:fs";
import path from "node:path";
import { UserSecretKey } from "@multiversx/sdk-wallet";
import chalk from "chalk";
import { http } from "msw";
import { setupServer } from "msw/node";
import { test, expect } from "vitest";
import { Context } from "../context";
import { getAddressShard } from "../data/utils";
import { Keystore } from "../world/signer";
import { getCli } from "./cli";
import { rustToolchain, rustTarget, rustKey } from "./helpers";

const cwd = process.cwd();
const pemPath = path.resolve("wallets", "wallet.pem");
const keyKeystorePath = path.resolve("wallets", "keystore_key.json");
const mneKeystorePath = path.resolve("wallets", "keystore_mnemonic.json");

test("new-wallet --wallet wallet.json", async () => {
  using c = newContext(true);
  const walletPath = path.resolve("wallet.json");
  c.input("1234", "1234");
  await c.cmd(`new-wallet --wallet ${walletPath}`);
  const keystore = Keystore.fromFile_unsafe(walletPath, "1234");
  const keystoreSigner = keystore.newSigner();
  expect(fs.existsSync(walletPath)).toEqual(true);
  expect(c.flushStdout().split("\n")).toEqual([
    `Creating keystore wallet at "${walletPath}"...`,
    "Enter password: ",
    "Re-enter password: ",
    "",
    chalk.green(`Wallet created at "${walletPath}".`),
    "",
    chalk.bold.blue("Address:") + ` ${keystoreSigner}`,
    "",
    chalk.bold.blue("Shard:") + ` ${getAddressShard(keystoreSigner)}`,
    "",
    chalk.bold.blue("Mnemonic phrase:"),
    ...keystore.getMnemonicWords().map((w, i) => `  ${i + 1}. ${w}`),
    "",
    chalk.bold.yellow("Please backup the mnemonic phrase in a secure place."),
    "",
  ]);
});

for (const shard of [0, 1, 2]) {
  test(`new-wallet --wallet wallet.json --shard ${shard}`, async () => {
    using c = newContext(true);
    const walletPath = path.resolve("wallet.json");
    c.input("1234", "1234");
    await c.cmd(`new-wallet --wallet ${walletPath} --shard ${shard}`);
    const keystore = Keystore.fromFile_unsafe(walletPath, "1234");
    expect(fs.existsSync(walletPath)).toEqual(true);
    expect(c.flushStdout().split("\n")).toEqual([
      `Creating keystore wallet at "${walletPath}"...`,
      "Enter password: ",
      "Re-enter password: ",
      "",
      chalk.green(`Wallet created at "${walletPath}".`),
      "",
      chalk.bold.blue("Address:") + ` ${keystore.newSigner()}`,
      "",
      chalk.bold.blue("Shard:") + ` ${shard}`,
      "",
      chalk.bold.blue("Mnemonic phrase:"),
      ...keystore.getMnemonicWords().map((w, i) => `  ${i + 1}. ${w}`),
      "",
      chalk.bold.yellow("Please backup the mnemonic phrase in a secure place."),
      "",
    ]);
  });
}

for (const shard of [-1, 3]) {
  test(`new-wallet --wallet wallet.json --shard ${shard} | error: The shard you entered does not exist`, async () => {
    using c = newContext(true);
    const walletPath = path.resolve("wallet.json");
    c.input("1234", "1234");
    await c.cmd(`new-wallet --wallet ${walletPath} --shard ${shard}`);
    expect(fs.existsSync(walletPath)).toEqual(false);
    expect(c.flushStdout().split("\n")).toEqual([
      `Creating keystore wallet at "${walletPath}"...`,
      "Enter password: ",
      "Re-enter password: ",
      "",
      chalk.red("The shard you entered does not exist."),
      "",
    ]);
  });
}

test("new-wallet --wallet wallet.json | error: passwords don't match", async () => {
  using c = newContext(true);
  const walletPath = path.resolve("wallet.json");
  c.input("1234", "1235");
  await c.cmd(`new-wallet --wallet ${walletPath}`);
  expect(c.flushStdout().split("\n")).toEqual([
    `Creating keystore wallet at "${walletPath}"...`,
    "Enter password: ",
    "Re-enter password: ",
    chalk.red("Passwords do not match."),
    "",
  ]);
});

test("new-wallet --wallet wallet.json | error: already exists", async () => {
  using c = newContext(true);
  const walletPath = path.resolve("wallet.json");
  fs.writeFileSync(walletPath, "");
  await c.cmd(`new-wallet --wallet ${walletPath}`);
  expect(c.flushStdout().split("\n")).toEqual([
    chalk.red(`Wallet already exists at "${walletPath}".`),
    "",
  ]);
});

test("new-wallet --wallet wallet.json --password 1234", async () => {
  using c = newContext(true);
  const walletPath = path.resolve("wallet.json");
  await c.cmd(`new-wallet --wallet ${walletPath} --password 1234`);
  const keystore = Keystore.fromFile_unsafe(walletPath, "1234");
  const keystoreSigner = keystore.newSigner();
  expect(fs.existsSync(walletPath)).toEqual(true);
  expect(c.flushStdout().split("\n")).toEqual([
    chalk.green(`Wallet created at "${walletPath}".`),
    "",
    chalk.bold.blue("Address:") + ` ${keystoreSigner}`,
    "",
    chalk.bold.blue("Shard:") + ` ${getAddressShard(keystoreSigner)}`,
    "",
    chalk.bold.blue("Mnemonic phrase:"),
    ...keystore.getMnemonicWords().map((w, i) => `  ${i + 1}. ${w}`),
    "",
    chalk.bold.yellow("Please backup the mnemonic phrase in a secure place."),
    "",
  ]);
});

test("new-wallet --wallet wallet.json --from-pem wallet.pem", async () => {
  using c = newContext(true);
  const walletPath = path.resolve("wallet.json");
  c.input("1234", "1234");
  await c.cmd(`new-wallet --wallet ${walletPath} --from-pem ${pemPath}`);
  const keystore = Keystore.fromFile_unsafe(walletPath, "1234");
  const keystoreSigner = keystore.newSigner();
  const secretKey = UserSecretKey.fromPem(
    fs.readFileSync(pemPath, "utf8"),
  ).hex();
  expect(keystore.getSecretKey()).toEqual(secretKey);
  expect(c.flushStdout().split("\n")).toEqual([
    `Creating keystore wallet at "${walletPath}"...`,
    "Enter password: ",
    "Re-enter password: ",
    "",
    chalk.green(`Wallet created at "${walletPath}".`),
    "",
    chalk.bold.blue("Address:") + ` ${keystoreSigner}`,
    "",
    chalk.bold.blue("Shard:") + ` ${getAddressShard(keystoreSigner)}`,
    "",
  ]);
});

test("new-wallet --wallet wallet.json --password 1234 --from-pem wallet.pem", async () => {
  using c = newContext(true);
  const walletPath = path.resolve("wallet.json");
  await c.cmd(
    `new-wallet --wallet ${walletPath} --password 1234 --from-pem ${pemPath}`,
  );
  const keystore = Keystore.fromFile_unsafe(walletPath, "1234");
  const keystoreSigner = keystore.newSigner();
  const secretKey = UserSecretKey.fromPem(
    fs.readFileSync(pemPath, "utf8"),
  ).hex();
  expect(keystore.getSecretKey()).toEqual(secretKey);
  expect(c.flushStdout().split("\n")).toEqual([
    chalk.green(`Wallet created at "${walletPath}".`),
    "",
    chalk.bold.blue("Address:") + ` ${keystoreSigner}`,
    "",
    chalk.bold.blue("Shard:") + ` ${getAddressShard(keystoreSigner)}`,
    "",
  ]);
});

test("new-wallet --wallet wallet.json --password 1234 --from-wallet keystore_key.json", async () => {
  using c = newContext(true);
  const walletPath = path.resolve("wallet.json");
  c.input("qpGjv7ZJ9gcPXWSN");
  await c.cmd(
    `new-wallet --wallet ${walletPath} --password 1234 --from-wallet ${keyKeystorePath}`,
  );
  const newKeystore = Keystore.fromFile_unsafe(walletPath, "1234");
  const oldKeystore = Keystore.fromFile_unsafe(
    keyKeystorePath,
    "qpGjv7ZJ9gcPXWSN",
  );
  const newKeystoreSigner = newKeystore.newSigner();
  const [newSignature, oldSignature] = await Promise.all([
    newKeystore.newSigner().sign(Buffer.from("hello")),
    oldKeystore.newSigner().sign(Buffer.from("hello")),
  ]);
  expect(newSignature).toEqual(oldSignature);
  expect(c.flushStdout().split("\n")).toEqual([
    `Loading keystore wallet at "${keyKeystorePath}"...`,
    "Enter password: ",
    chalk.green(`Wallet created at "${walletPath}".`),
    "",
    chalk.bold.blue("Address:") + ` ${newKeystoreSigner}`,
    "",
    chalk.bold.blue("Shard:") + ` ${getAddressShard(newKeystoreSigner)}`,
    "",
  ]);
});

test("new-wallet --wallet wallet.json --password 1234 --from-wallet keystore_mnemonic.json", async () => {
  using c = newContext(true);
  const walletPath = path.resolve("wallet.json");
  c.input("1234");
  await c.cmd(
    `new-wallet --wallet ${walletPath} --password 1234 --from-wallet ${mneKeystorePath}`,
  );
  const newKeystore = Keystore.fromFile_unsafe(walletPath, "1234");
  const oldKeystore = Keystore.fromFile_unsafe(mneKeystorePath, "1234");
  const [newSignature, oldSignature] = await Promise.all([
    newKeystore.newSigner().sign(Buffer.from("hello")),
    oldKeystore.newSigner().sign(Buffer.from("hello")),
  ]);
  const newKeystoreSigner = newKeystore.newSigner();
  expect(newSignature).toEqual(oldSignature);
  expect(c.flushStdout().split("\n")).toEqual([
    `Loading keystore wallet at "${mneKeystorePath}"...`,
    "Enter password: ",
    chalk.green(`Wallet created at "${walletPath}".`),
    "",
    chalk.bold.blue("Address:") + ` ${newKeystoreSigner}`,
    "",
    chalk.bold.blue("Shard:") + ` ${getAddressShard(newKeystoreSigner)}`,
    "",
    chalk.bold.blue("Mnemonic phrase:"),
    ...newKeystore.getMnemonicWords().map((w, i) => `  ${i + 1}. ${w}`),
    "",
    chalk.bold.yellow("Please backup the mnemonic phrase in a secure place."),
    "",
  ]);
});

test("request-xegld --wallet wallet.json", async () => {
  using c = newContext(true);
  const walletPath = path.resolve("wallet.json");
  fs.copyFileSync(mneKeystorePath, walletPath);
  const signer = Keystore.fromFile_unsafe(walletPath, "1234").newSigner();
  const address = signer.toString();
  let balances: number[] = [];
  const server = setupServer(
    http.get("https://devnet-api.multiversx.com/blocks/latest", () =>
      Response.json({ hash: "" }),
    ),
    http.get("https://devnet-api.multiversx.com/blocks", () =>
      Response.json([{ hash: "" }]),
    ),
    http.get(
      `https://devnet-gateway.multiversx.com/address/${address}/balance`,
      () => {
        const balance = `${BigInt(balances.shift() ?? 0) * 10n ** 18n}`;
        return Response.json({ code: "successful", data: { balance } });
      },
    ),
  );
  server.listen();
  c.input("1234", "1234");
  balances = [0, 1];
  await c.cmd(`request-xegld --wallet ${walletPath}`);
  balances = [0, 10];
  await c.cmd(`request-xegld --wallet ${walletPath} --password 1234`);
  server.close();
  const splittedStdoutData = c.flushStdout().split("\n");
  expect(splittedStdoutData).toEqual([
    `Loading keystore wallet at "${walletPath}"...`,
    "Enter password: ",
    "",
    `Claiming xEGLD for address "${address}"...`,
    "",
    "Open the URL and request tokens:",
    splittedStdoutData.at(6),
    "",
    chalk.green("Wallet well received 1 xEGLD."),
    `Claiming xEGLD for address "${address}"...`,
    "",
    "Open the URL and request tokens:",
    splittedStdoutData.at(12),
    "",
    chalk.green("Wallet well received 10 xEGLD."),
    "",
  ]);
});

test("install-rust-key", async () => {
  using c = newContext(true);
  await c.cmd("install-rust-key");
  expect(c.flushStdout().split("\n")).toEqual([rustKey, ""]);
});

test("install-rust", async () => {
  using c = newContext(true);
  await c.cmd("install-rust");
  expect(c.flushStdout().split("\n")).toEqual([
    chalk.blue(
      `Installing Rust: toolchain ${rustToolchain} & target ${rustTarget}...`,
    ),
    chalk.cyan(
      `$ curl --proto =https --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- --default-toolchain ${rustToolchain} -t ${rustTarget} -y`,
    ),
    "",
  ]);
});

test("new --dir contract && build --locked && build -r && test-rust && test-scen", async () => {
  using c = newContext(true);

  await c.cmd("new --dir contract");
  expect(fs.readdirSync(process.cwd()).length).toEqual(1);
  const dir = "contract";
  const absDir = path.resolve(dir);
  expect(c.flushStdout().split("\n")).toEqual([
    chalk.blue(
      `Downloading contract ${chalk.magenta("blank")} in "${absDir}"...`,
    ),
    "",
    chalk.blue("Installing packages..."),
    chalk.cyan("$ npm install"),
    "",
    chalk.blue("Initialized a git repository."),
    "",
    chalk.green(
      `Successfully created ${chalk.magenta("blank")} in "${absDir}".`,
    ),
    "",
    "Inside that directory, you can run several commands:",
    "",
    chalk.cyan("  npm run build"),
    "    Builds the contract.",
    "",
    chalk.cyan("  npm run test"),
    "    Tests the contract.",
    "",
    chalk.cyan("  npm run deploy"),
    "    Deploys the contract to devnet.",
    "",
    "We suggest that you begin by typing:",
    "",
    chalk.cyan(`  cd ${dir}`),
    chalk.cyan("  npm run build"),
    "",
  ]);

  const targetDir = path.join(__dirname, "..", "..", "..", "target");
  process.chdir(absDir);

  await c.cmd(`build --locked --target-dir ${targetDir}`);
  expect(c.flushStdout().split("\n")).toEqual([
    chalk.blue("Building contract..."),
    `(1/1) Building "${absDir}"...`,
    chalk.cyan(
      `$ cargo run --target-dir ${targetDir} build --locked --target-dir ${targetDir}`,
    ),
    "",
  ]);

  await c.cmd(`build -r --target-dir ${targetDir}`);
  expect(c.flushStdout().split("\n")).toEqual([
    chalk.blue("Building contract..."),
    `(1/1) Building "${absDir}"...`,
    chalk.cyan(
      `$ cargo run --target-dir ${targetDir} build --target-dir ${targetDir}`,
    ),
    "",
  ]);

  await c.cmd(`test-rust --target-dir ${targetDir}`);
  expect(c.flushStdout().split("\n")).toEqual([
    chalk.blue("Testing contract with Rust tests..."),
    chalk.cyan(`$ cargo test --target-dir ${targetDir}`),
    "",
  ]);

  const extractPath = path.join(
    __dirname,
    "..",
    "..",
    "bin",
    "scenexec-v1.5.22-ubuntu-20.04",
  );
  const binaryPath = path.join(extractPath, "scenexec");
  fs.rmSync(extractPath, { recursive: true, force: true });
  await c.cmd("test-scen");
  expect(c.flushStdout().split("\n")).toEqual([
    chalk.blue("Testing contract with scenarios..."),
    "Downloading scenexec-v1.5.22-ubuntu-20.04...",
    chalk.cyan(`$ ${binaryPath} .`),
    "",
  ]);
}, 600_000);

test("new --starter vested-transfers --dir contract --no-git --no-install", async () => {
  using c = newContext(true);
  const contract = "vested-transfers";
  await c.cmd(`new --starter ${contract} --dir contract --no-git --no-install`);
  expect(fs.readdirSync(process.cwd()).length).toEqual(1);
  const contractChalk = chalk.magenta(contract);
  const dir = "contract";
  const absDir = path.resolve(dir);
  expect(c.flushStdout().split("\n")).toEqual([
    chalk.blue(`Downloading contract ${contractChalk} in "${absDir}"...`),
    "",
    chalk.green(`Successfully created ${contractChalk} in "${absDir}".`),
    "",
    "Inside that directory, you can run several commands:",
    "",
    chalk.cyan("  npm run build"),
    "    Builds the contract.",
    "",
    chalk.cyan("  npm run test"),
    "    Tests the contract.",
    "",
    chalk.cyan("  npm run deploy"),
    "    Deploys the contract to devnet.",
    "",
    "We suggest that you begin by typing:",
    "",
    chalk.cyan(`  cd ${dir}`),
    chalk.cyan("  npm run build"),
    "",
  ]);
});

test("new --dir contract | error: already exists", async () => {
  using c = newContext(true);
  fs.mkdirSync("contract");
  await c.cmd("new --dir contract");
  const dirPath = path.resolve("contract");
  expect(c.flushStdout()).toEqual(
    chalk.red(`Directory already exists at "${dirPath}".`) + "\n",
  );
});

const newContext = (chdir = false) => {
  const ctx = new Context({ cwd: fs.mkdtempSync("/tmp/xsuite-tests-") });
  if (chdir) process.chdir(ctx.cwd());
  return Object.assign(ctx, {
    cmd: (c: string) => {
      return ctx.run(() => getCli().parseAsync(c.split(" "), { from: "user" }));
    },
    [Symbol.dispose]() {
      fs.rmSync(ctx.cwd(), { recursive: true, force: true });
      if (chdir) process.chdir(cwd);
    },
  });
};
