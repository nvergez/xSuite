import { expect, test } from "vitest";
import { Context, log, readHidden } from "./context";

test("log inside context", async () => {
  const ctx = new Context();
  ctx.run(() => log("hello!"));
  expect(ctx.flushStdout()).toEqual("hello!\n");
});

test("log outside context", async () => {
  const int = new StdoutInterceptor();
  log("hello!");
  expect(int.stdout).toEqual("hello!\n");
});

test("readHidden inside context", async () => {
  const ctx = new Context();
  ctx.input("test");
  const result = await ctx.run(() => readHidden("Query: "));
  expect(ctx.flushStdout()).toEqual("Query: \n");
  expect(result).toEqual("test");
  expect(() => ctx.run(() => readHidden("Query: "))).toThrow(
    "Undefined input.",
  );
});

test("readHidden outside context", async () => {
  const int = new StdoutInterceptor();
  process.nextTick(() => {
    process.stdin.emit("data", "test\n");
  });
  const result = await readHidden("Query: ");
  expect(int.stdout).toEqual("\u001b[1G\u001b[0JQuery: \u001b[8G\n");
  expect(result).toEqual("test");
});

class StdoutInterceptor {
  stdout: string;
  realWrite: typeof process.stdout.write;

  constructor() {
    this.stdout = "";
    this.realWrite = process.stdout.write;
    process.stdout.write = (s: Uint8Array | string) => {
      this.stdout += typeof s === "string" ? s : new TextDecoder().decode(s);
      return true;
    };
  }

  [Symbol.dispose]() {
    process.stdout.write = this.realWrite;
  }
}
