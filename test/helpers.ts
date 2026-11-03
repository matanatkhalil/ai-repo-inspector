import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");

export function nodeCommand(code: string): string {
  return `"${process.execPath}" -e "${code}"`;
}

export function createRepository(): string {
  const repository = mkdtempSync(join(tmpdir(), "inspector repo "));
  const git = (...args: string[]) => execFileSync("git", [
    "-c", "user.name=Inspector Test",
    "-c", "user.email=inspector@example.invalid",
    "-c", "commit.gpgSign=false",
    "-c", `core.hooksPath=${join(repository, "no-hooks")}`,
    ...args,
  ], { cwd: repository, stdio: "pipe" });

  try {
    git("init", "-b", "main");
    writeFileSync(join(repository, "baseline.txt"), "baseline\n");
    git("add", "baseline.txt");
    git("commit", "-m", "Baseline");
    writeFileSync(join(repository, "requested-repository.txt"), "committed change\n");
    git("add", "requested-repository.txt");
    git("commit", "-m", "Change to inspect");
    writeFileSync(join(repository, "baseline.txt"), "uncommitted edit\n");
    writeFileSync(join(repository, "untracked.txt"), "untracked\n");
    return repository;
  } catch (error) {
    rmSync(repository, { recursive: true, force: true });
    throw error;
  }
}

export function runCli(repository: string, args: string[]) {
  return spawnSync(process.execPath, [
    tsxCli, join(projectRoot, "src/cli.ts"), "review", ...args,
  ], { cwd: repository, encoding: "utf8", timeout: 10_000 });
}
