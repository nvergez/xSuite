import { ChildProcess } from "node:child_process";
import { AddressLike, isAddressLike } from "../data/addressLike";
import { EncodableAccount } from "../data/encoding";
import { Prettify } from "../helpers";
import { FSProxy } from "../proxy";
import { killChildProcess } from "./childProcesses";
import { startFsproxyBin } from "./fsproxyBin";
import { DummySigner, Signer } from "./signer";
import { createU8AAddress } from "./utils";
import {
  World,
  Contract,
  Wallet,
  expandCode,
  WalletDeployContractTx,
  WorldNewOptions,
  WorldDeployContractTx,
} from "./world";

export class FSWorld extends World {
  proxy: FSProxy;
  server?: ChildProcess;

  constructor({
    proxy,
    gasPrice,
    explorerUrl,
    server,
  }: {
    proxy: FSProxy;
    gasPrice: number;
    explorerUrl?: string;
    server?: ChildProcess;
  }) {
    super({ chainId: "chain", proxy, gasPrice, explorerUrl });
    this.proxy = proxy;
    this.server = server;
  }

  static new(options: FSWorldNewOptions) {
    if (options.chainId !== undefined) {
      throw new Error("chainId is not undefined.");
    }
    const { proxyUrl, gasPrice, explorerUrl, server } = options;
    return new FSWorld({
      proxy: new FSProxy({ proxyUrl, explorerUrl }),
      gasPrice: gasPrice ?? 1_000_000_000,
      explorerUrl,
      server,
    });
  }

  static newDevnet(): World {
    throw new Error("newDevnet is not implemented.");
  }

  static newTestnet(): World {
    throw new Error("newTestnet is not implemented.");
  }

  static newMainnet(): World {
    throw new Error("newMainnet is not implemented.");
  }

  static async start({
    gasPrice,
    explorerUrl,
  }: { gasPrice?: number; explorerUrl?: string } = {}): Promise<FSWorld> {
    const { server, proxyUrl } = await startFsproxyBin();
    return FSWorld.new({ proxyUrl, gasPrice, explorerUrl, server });
  }

  newWallet(addressOrSigner: AddressLike | Signer): FSWallet {
    return new FSWallet({
      signer: isAddressLike(addressOrSigner)
        ? new DummySigner(addressOrSigner)
        : addressOrSigner,
      world: this,
    });
  }

  newContract(address: AddressLike): FSContract {
    return new FSContract({ address, world: this });
  }

  async createWallet({ address, ...params }: FSWorldCreateAccountParams = {}) {
    if (
      address === undefined ||
      (typeof address === "object" && "shard" in address)
    ) {
      address = createU8AAddress({ type: "wallet", shard: address?.shard });
    }
    await this.setAccount({ address, ...params });
    return this.newWallet(new DummySigner(address));
  }

  async createContract({
    address,
    ...params
  }: FSWorldCreateAccountParams = {}) {
    if (
      address === undefined ||
      (typeof address === "object" && "shard" in address)
    ) {
      address = createU8AAddress({
        type: "vmContract",
        shard: address?.shard,
      });
    }
    await this.setAccount({ address, ...params });
    return this.newContract(address);
  }

  getInitialAddresses() {
    return this.proxy.getInitialAddresses();
  }

  async setAccounts(params: FSWorldSetAccountsParams) {
    for (const _params of params) {
      if (_params.code !== undefined) {
        _params.code = expandCode(_params.code);
      }
    }
    return this.proxy.setAccounts(params);
  }

  setAccount(params: FSWorldSetAccountParams) {
    return this.setAccounts([params]);
  }

  async generateBlocks(numBlocks: number) {
    return this.proxy.generateBlocks(numBlocks);
  }

  async generateBlock() {
    return this.proxy.generateBlock();
  }

  // TODO-MvX: replace by the new one that will force skip the epoch
  async generateBlocksUntilEpochReached(epoch: number) {
    return this.proxy.generateBlocksUntilEpochReached(epoch);
  }

  // TODO-MvX: to be removed when built-in in chain simulator
  async generateBlocksUntilTxCompleted(txHash: string) {
    let res = await this.proxy.getTxProcessStatus(txHash);
    while (res === "pending") {
      await this.generateBlock();
      res = await this.proxy.getTxProcessStatus(txHash);
    }
  }

  awaitTx(txHash: string) {
    return this.generateBlocksUntilTxCompleted(txHash);
  }

  async sendTx(...[tx]: Parameters<typeof World.prototype.sendTx>) {
    const txHash = await super.sendTx(tx);
    await new Promise((r) => setTimeout(r, 250)); // TODO-MvX: to be removed once they fix this
    return txHash;
  }

  async sendTransfer(...[tx]: Parameters<typeof World.prototype.sendTransfer>) {
    const txHash = await super.sendTransfer(tx);
    await new Promise((r) => setTimeout(r, 250)); // TODO-MvX: to be removed once they fix this
    return txHash;
  }

  async sendDeployContract(
    ...[tx]: Parameters<typeof World.prototype.sendDeployContract>
  ) {
    const txHash = await super.sendDeployContract(tx);
    await new Promise((r) => setTimeout(r, 250)); // TODO-MvX: to be removed once they fix this
    return txHash;
  }

  async sendCallContract(
    ...[tx]: Parameters<typeof World.prototype.sendCallContract>
  ) {
    const txHash = await super.sendCallContract(tx);
    await new Promise((r) => setTimeout(r, 250)); // TODO-MvX: to be removed once they fix this
    return txHash;
  }

  async sendUpgradeContract(
    ...[tx]: Parameters<typeof World.prototype.sendUpgradeContract>
  ) {
    const txHash = await super.sendUpgradeContract(tx);
    await new Promise((r) => setTimeout(r, 250)); // TODO-MvX: to be removed once they fix this
    return txHash;
  }

  deployContract(tx: WorldDeployContractTx) {
    return super
      .deployContract(tx)
      .then((res) => ({ ...res, contract: this.newContract(res.address) }));
  }

  terminate() {
    if (!this.server) throw new Error("No server defined.");
    killChildProcess(this.server);
  }
}

export class FSWallet extends Wallet {
  world: FSWorld;

  constructor({ signer, world }: { signer: Signer; world: FSWorld }) {
    super({ signer, world });
    this.world = world;
  }

  setAccount(params: FSAccountSetAccountParams) {
    return this.world.setAccount({ ...params, address: this });
  }

  createContract(params?: FSWalletCreateContractParams) {
    return this.world.createContract({ ...params, owner: this });
  }

  deployContract(tx: WalletDeployContractTx) {
    return this.world.deployContract({ ...tx, sender: this });
  }
}

export class FSContract extends Contract {
  world: FSWorld;

  constructor({ address, world }: { address: AddressLike; world: FSWorld }) {
    super({ address, world });
    this.world = world;
  }

  setAccount(params: FSAccountSetAccountParams) {
    return this.world.setAccount({ ...params, address: this });
  }
}

type FSWorldNewOptions =
  | {
      chainId?: undefined;
      proxyUrl: string;
      gasPrice?: number;
      explorerUrl?: string;
      server?: ChildProcess;
    }
  | WorldNewOptions;

type FSWorldCreateAccountParams = Prettify<
  Partial<
    Omit<EncodableAccount, "address"> & {
      address: AddressLike | { shard: number };
    }
  >
>;

type FSWorldSetAccountsParams = EncodableAccount[];

type FSWorldSetAccountParams = EncodableAccount;

type FSAccountSetAccountParams = Prettify<
  Omit<FSWorldSetAccountParams, "address">
>;

type FSWalletCreateContractParams = Prettify<
  Omit<FSWorldCreateAccountParams, "owner">
>;
