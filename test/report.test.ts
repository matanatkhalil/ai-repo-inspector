import { describe, expect, it } from "vitest";
import { markdownReport } from "../src/report.js";

describe("markdownReport", () => {
  it("lists changed files and validation output", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [{ path: "src/index.ts", status: "modified" }],
      validationResults: [
        { command: "npm test", status: "passed", output: "ok", exitCode: 0 },
        {
          command: "lint", status: "failed", output: "", exitCode: 2,
          failureReason: "command", error: "Lint failed",
        },
      ],
    });

    expect(report).toContain("src/index.ts (modified)");
    expect(report).toContain("npm test");
    expect(report).toContain("ok");
    expect(report).toContain("Status: passed");
    expect(report).toContain("Status: failed");
    expect(report).toContain("Exit code: 2");
    expect(report).toContain("Failure reason: command");
    expect(report).toContain("(no output)");
    expect(report).toContain("Lint failed");
  });
});
