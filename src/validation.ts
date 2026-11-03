import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

const VALIDATION_TIMEOUT_MS = 120_000;
const VALIDATION_MAX_BUFFER_BYTES = 1024 * 1024;

export function runValidation(
  command: string,
  cwd: string,
): Promise<ValidationResult> {
  return new Promise((resolve) => {
    let timedOut = false;
    const child = exec(command, { cwd, maxBuffer: VALIDATION_MAX_BUFFER_BYTES }, (error, stdout, stderr) => {
      clearTimeout(timer);
      // Node can return a string error code for maxBuffer overflow.
      const errorCode: unknown = error?.code;
      const failureReason = timedOut
        ? "timeout"
        : errorCode === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
          ? "output-limit"
          : error
            ? "command"
            : undefined;
      const output = [
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      resolve({
        command,
        status: failureReason ? "failed" : "passed",
        output,
        exitCode: failureReason
          ? !timedOut && typeof errorCode === "number"
            ? errorCode
            : null
          : 0,
        failureReason,
        error: timedOut
          ? `Validation exceeded the ${VALIDATION_TIMEOUT_MS / 1000}-second timeout; termination was requested.`
          : failureReason === "output-limit"
            ? `Validation exceeded the ${VALIDATION_MAX_BUFFER_BYTES}-byte output limit for stdout or stderr. Captured output may be incomplete.`
            : error?.message,
      });
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, VALIDATION_TIMEOUT_MS);
  });
}

export async function runValidations(commands: string[], cwd: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd));
  }
  return results;
}
