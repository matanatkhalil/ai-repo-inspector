import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

export function runValidation(
  command: string,
  cwd: string,
): Promise<ValidationResult> {
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      const output = [
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      resolve({
        command,
        status: error ? "failed" : "passed",
        output,
        exitCode: error
          ? typeof error.code === "number"
            ? error.code
            : null
          : 0,
        error: error?.message,
      });
    });
  });
}

export async function runValidations(commands: string[], cwd: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidation(command, cwd));
  }
  return results;
}
