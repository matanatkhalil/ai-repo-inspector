import { afterEach, describe, expect, it, vi } from "vitest";
import { runValidations } from "../src/validation.js";
import { nodeCommand } from "./helpers.js";

afterEach(() => vi.useRealTimers());

describe("validation execution", () => {
  it("preserves both streams and continues after a nonzero exit", async () => {
    const results = await runValidations([
      nodeCommand("console.log('out');console.error('err');process.exit(2)"),
      nodeCommand("console.log('later')"),
    ], process.cwd());

    expect(results[0]).toMatchObject({
      status: "failed", exitCode: 2, failureReason: "command",
    });
    expect(results[0].output).toContain("stdout:\nout");
    expect(results[0].output).toContain("stderr:\nerr");
    expect(results[1]).toMatchObject({ status: "passed", exitCode: 0 });
    expect(results[1].output).toContain("later");
  });

  it.each(["stdout", "stderr"])("reports the %s output limit and continues", async (stream) => {
    const results = await runValidations([
      nodeCommand(`process.${stream}.write('x'.repeat(1100000))`),
      nodeCommand("console.log('later')"),
    ], process.cwd());

    expect(results[0]).toMatchObject({
      status: "failed", exitCode: null, failureReason: "output-limit",
    });
    expect(results[0].error).toContain("1048576-byte output limit");
    expect(Buffer.byteLength(results[0].output)).toBeLessThanOrEqual(1024 * 1024 + 100);
    expect(results[1].status).toBe("passed");
  });

  it("reports the default timeout and still runs the next command", async () => {
    // Advance only the deadline timers; subprocess execution and I/O stay real.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const pending = runValidations([
      nodeCommand("setTimeout(console.log,2000)"),
      nodeCommand("console.log('later')"),
    ], process.cwd());
    await vi.advanceTimersByTimeAsync(120_000);
    const results = await pending;

    expect(results[0]).toMatchObject({
      status: "failed", exitCode: null, failureReason: "timeout",
    });
    expect(results[0].error).toContain("120-second timeout");
    expect(results[1].status).toBe("passed");
    expect(vi.getTimerCount()).toBe(0);
  }, 10_000);
});
