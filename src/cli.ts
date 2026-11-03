#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { reviewRepository } from "./core.js";

type Args = {
  command: string;
  repositoryPath?: string;
  baseRef?: string;
  format?: "markdown";
  validations: string[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0] ?? "", validations: [] };
  for (let index = 1; index < argv.length; index++) {
    const token = argv[index];
    if (!["--repo", "--base-ref", "--format", "--validate"].includes(token)) {
      throw new Error(`Unknown argument: ${token}`);
    }
    const value = argv[++index];
    if (value === undefined || value.trim().length === 0 || value.startsWith("--")) {
      throw new Error(`Missing or invalid value for ${token}.`);
    }
    if (token === "--repo") {
      args.repositoryPath = value;
    } else if (token === "--base-ref") {
      args.baseRef = value;
    } else if (token === "--format") {
      if (value !== "markdown") {
        throw new Error("Only markdown format is supported.");
      }
      args.format = value;
    } else if (token === "--validate") {
      args.validations.push(value);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== "review" || !args.repositoryPath) {
    console.error("Usage: inspector review --repo <path> [--base-ref <ref>] [--format markdown] [--validate <command>]");
    process.exitCode = 1;
    return;
  }

  const result = await reviewRepository({
    repositoryPath: args.repositoryPath,
    baseRef: args.baseRef,
    validationCommands: args.validations,
    format: args.format,
  });
  writeFileSync("review-report.md", result.report, "utf8");

  if (
    result.validationResults.some(
      (validation) => validation.status === "failed",
    )
  ) {
    process.exitCode = 1;
  }

  console.log("Review report written to review-report.md");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
