import { test, beforeEach, afterEach } from "vitest";
import { assertAccount } from "xsuite/assert";
import { SWorld, SWallet, SContract } from "xsuite/world";

let world: SWorld;
let deployer: SWallet;
let contract: SContract;

beforeEach(async () => {
  world = await SWorld.start();
  deployer = await world.createWallet();
  ({ contract } = await deployer.deployContract({
    code: "file:output/contract.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
  }));
});

afterEach(async () => {
  await world.terminate();
});

test("Test", async () => {
  assertAccount(await contract.getAccountWithPairs(), {
    balance: 0n,
    hasPairs: [],
  });
});
