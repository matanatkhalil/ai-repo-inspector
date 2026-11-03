# Repository Inspector

This is a small TypeScript developer tool that inspects changes in a Git
repository, runs optional validation commands, and produces a Markdown report.
It can be used from a command line or exposed to AI clients through MCP.

The tool supports both CLI and stdio MCP usage for trusted local developers and coding agents. Both interfaces use the same review pipeline.

## Review scope 
By default, the tool compares committed changes from the merge base of `main` and `HEAD` to `HEAD`. Use `--base-ref` or MCP’s `baseRef` to select another base. Staged, unstaged, and untracked changes are excluded. Validation commands run against the current working tree, so their results may reflect uncommitted edits. The selected base reference must exist in the repository.

## Your task

Investigate the repository and improve it as you judge best. The starter works
for a narrow happy path, but production use may expose correctness, safety,
reliability, contract, output, documentation, or testing weaknesses.

You are not expected to finish everything. We care about how you investigate,
prioritize, implement, verify, and explain a meaningful scope.

## Product decision

This tool may be used directly by developers and by AI coding agents. Decide
whether its production interface should be **CLI-first**, **MCP-first**, or
**hybrid**. Implement improvements consistent with your decision.

There is no preferred label. Explain:

- The primary user and execution environment you assumed.
- The trust boundary and allowed capabilities.
- Reliability, discoverability, latency/context, and output-size tradeoffs.
- How the interfaces you continue to advertise stay behaviorally consistent.
- What evidence would change your decision.

## Time and rules

- Maximum **90 focused minutes** within 48 hours of receiving the invitation.
- Use AI coding tools freely. Verify their work and document at least one
  suggestion you corrected or rejected.
- Work in your own repository created from this template.
- Commit as you work and complete `SUBMISSION.md` in your final commit.
- Completion is not required. Accurate scope and verification matter more than
  a large diff.

## Setup

```bash
npm install
npm run typecheck
npm test
```

## CLI

```bash
npm run inspector -- review --repo ./path/to/repo --format markdown
npm run inspector -- review --repo ./path/to/repo --validate "npm test"
```

The CLI writes `review-report.md` in its current working directory, overwriting an existing file. It exits with `0` when no validations fail and the review succeeds, or `1` for validation failures or operational errors. Validation failures still produce a report; operational errors may prevent one. Only Markdown output is supported. 

## MCP

Start the stdio server with:

```bash
npm run mcp-server
```

The `review_repository` tool requires `repo_path`; the other fields are optional. It returns a Markdown report as text without writing a report file. Failed validations appear in the report; invalid inputs or repository errors return tool errors.

```json
{
  "repo_path": "/absolute/path/to/repository",
  "baseRef": "main",
  "validationCommands": ["npm test"]
}
```

## Validation limits and trust
Validation commands run sequentially, and later commands continue after a failure. Each command has a 120-second timeout that requests termination and a 1 MiB output-buffer limit per stream. Descendant processes may continue running and delay completion. Commands inherit the inspector’s permissions and environment; only trusted commands, project scripts, and MCP clients should be used. Execution is not sandboxed.

## Project layout

```text
src/core.ts         shared review orchestration
src/cli.ts          command-line adapter
src/mcp-server.ts   MCP adapter
src/git.ts          Git inspection
src/validation.ts   validation execution
src/report.ts       Markdown report generation
test/               regression and CLI/MCP integration tests
```

When finished, submit via **Security → Report a vulnerability** on this
repo — see `SECURITY.md` for exactly what to include. Do not reply by email;
that submission channel is not monitored.