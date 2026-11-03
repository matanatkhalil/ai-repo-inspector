import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, it } from "vitest";
import { createRepository, nodeCommand, projectRoot, runCli, tsxCli } from "./helpers.js";

async function withMcpClient(run: (client: Client) => Promise<void>) {
  const client = new Client({ name: "inspector-integration-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCli, join(projectRoot, "src/mcp-server.ts")],
    // Different from the fixture: catches accidental server-cwd fallback.
    cwd: projectRoot,
  });
  try {
    await client.connect(transport);
    await run(client);
  } finally {
    await client.close();
  }
}

it("CLI and MCP inspect the requested repository and report the same validation failures", async () => {
  const repository = createRepository();
  try {
    const commands = [
      nodeCommand("console.log('out');console.error('err');process.exit(2)"),
      nodeCommand("console.log('later')"),
    ];
    const cli = runCli(repository, [
      "--repo", repository, "--base-ref", "HEAD~1",
      "--validate", commands[0], "--validate", commands[1],
    ]);
    expect(cli.error).toBeUndefined();
    expect(cli.status).toBe(1);
    expect(cli.stdout).toContain("Review report written");
    const report = readFileSync(join(repository, "review-report.md"), "utf8");
    expect(report).toContain(repository);
    expect(report).toContain("requested-repository.txt (added)");
    expect(report).not.toContain("baseline.txt (modified)");
    expect(report).not.toContain("untracked.txt (");
    expect(report).toContain("Status: failed");
    expect(report).toContain("Exit code: 2");
    expect(report).toContain("stdout:\nout");
    expect(report).toContain("stderr:\nerr");
    expect(report).toContain("Status: passed");
    expect(report).toContain("later");

    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: "review_repository",
        arguments: { repo_path: repository, baseRef: "HEAD~1", validationCommands: commands },
      });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([{ type: "text", text: report }]);
    });
    const successful = runCli(repository, ["--repo", repository, "--base-ref", "HEAD"]);
    expect(successful.error).toBeUndefined();
    expect(successful.status).toBe(0);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
}, 15_000);

it("adapters reject invalid inputs without overwriting an existing report", async () => {
  const repository = createRepository();
  try {
    const reportPath = join(repository, "review-report.md");
    writeFileSync(reportPath, "existing report");
    for (const args of [["--unknown"], ["--validate"], ["--format", "json"], ["--validate", " "]]) {
      const cli = runCli(repository, ["--repo", repository, ...args]);
      expect(cli.error).toBeUndefined();
      expect(cli.status).toBe(1);
      expect(cli.stderr).toMatch(/Unknown argument|Missing or invalid|Only markdown/);
      expect(readFileSync(reportPath, "utf8")).toBe("existing report");
    }
    await withMcpClient(async (client) => {
      for (const input of [
        { repo_path: " " }, { validationCommands: [" "] },
        { repo_path: join(repository, "missing") },
      ]) {
        const result = await client.callTool({
          name: "review_repository",
          arguments: { repo_path: repository, baseRef: "HEAD", ...input },
        });
        expect(result.isError).toBe(true);
      }
    });
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
}, 15_000);

it("both adapters preserve output-limit failures and subsequent validation results", async () => {
  const repository = createRepository();
  try {
    const commands = [
      nodeCommand("process.stdout.write('x'.repeat(1100000))"),
      nodeCommand("console.log('later')"),
    ];
    const cli = runCli(repository, [
      "--repo", repository, "--base-ref", "HEAD",
      "--validate", commands[0], "--validate", commands[1],
    ]);
    expect(cli.error).toBeUndefined();
    expect(cli.status).toBe(1);
    const report = readFileSync(join(repository, "review-report.md"), "utf8");
    expect(report).toContain("Failure reason: output-limit");
    expect(report).toContain("Status: passed");
    expect(report).toContain("later");
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: "review_repository",
        arguments: { repo_path: repository, baseRef: "HEAD", validationCommands: commands },
      });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([{
        type: "text",
        text: expect.stringContaining("Failure reason: output-limit"),
      }]);
      expect(result.content).toEqual([{
        type: "text", text: expect.stringContaining("stdout:\nlater"),
      }]);
    });
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
}, 15_000);
