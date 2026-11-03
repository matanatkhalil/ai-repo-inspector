# Submission

## What did you investigate first, and why?
Before changing any code, I ran the four baseline commands to understand the project's initial state and to identify any existing problems I could reproduce. The results were as follows:
- Baseline typecheck (`npm run typecheck`): passed.
- Baseline tests (`npm test`): passed (1 test). (Note: A subsequent test run with build output present discovered duplicate execution of the report test from both `test/report.test.ts` and `dist/test/report.test.js`. This did not provide additional behavioral coverage.)
- Baseline build (`npm run build`): passed.
- Dependency audit (`npm audit`): Reported 15 vulnerabilities across the dependency tree.

The application passed all existing checks, providing a working baseline for further investigation. I noted the dependency vulnerabilities for later review, as I wanted to prioritize investigating the application's core functionality and potential issues within the codebase first, given the assessment's time constraints.

Next, I explored the existing application to understand its functionality and trace how the main components interact, from receiving user input to generating the review report.

I focused on:

- Execution flow: How the CLI and MCP interfaces interact with the shared core functionality.
- Git inspection: How the application identifies changed files and what changes are included in the review.
- Validation execution: How user-provided commands are executed and how failures are handled.
- Report generation: What information is included in the output and whether the results accurately reflect the inspection.

A few findings/observations:
- MCP accepts `repo_path` but reads `repoPath`.
- Failed validations abort report generation, and `stdout || stderr` can discard stderr.
- Git inspects committed branch changes, while validation runs against the working tree.
- CLI paths containing spaces are truncated, and JSON is accepted but not implemented.

This investigation helped me understand the existing behavior, identify potential correctness, reliability, and security risks, and establish what the product is supposed to do, which risks matter most, and what I should prioritize improving within the available time.

## What did you choose to implement or fix?
First, I will correct repository selection across CLI and MCP: fix the MCP input mapping, preserve CLI paths containing spaces, and reject missing or empty paths in the shared core. This prevents misleading reports and accidental command execution in the server’s working directory. My planned scope: I will collect validation failures, preserve stdout and stderr, and display each command’s status in the report. I will add a default validation timeout and an explicit output-buffer limit, reporting these conditions as failures rather than losing the review report. Configurable limits and comprehensive cross-platform process-tree cleanup are outside the initial scope. A failed validation must become a reported result—not prevent the entire report from being generated.

## What did you intentionally not do?
I kept Git inspection limited to committed changes between the selected base reference and `HEAD`. I did not extend it to include staged, unstaged, or untracked working-tree changes, as that would expand the scope and require additional Git handling and tests.

## Interface decision

- **Decision: Hybrid, scoped to trusted local development.**
Developers use the CLI, and locally connected coding agents use the stdio MCP tool. I chose hybrid because the starter already separates the adapters from shared review logic, which allows core fixes to benefit both developers and coding agents. The starter already supports both interfaces, and retaining them while sharing the same core logic avoids duplicating the review logic, while still requiring contract tests for each adapter. My planned scope prioritizes a narrow shared contract and adapter integration tests rather than adding separate capabilities to each interface. Both adapters will use the shared review pipeline, with equivalent repository-selection behavior and validation execution policies. 
- **Primary user and execution environment:**
The primary users are **local developers and their coding agents**. CLI and MCP serve different interaction styles while sharing the same review pipeline. I assumed a **trusted local execution environment** where the tool runs locally with the developer's OS permissions, with validation commands explicitly supplied by the caller.
- **Trust boundary and allowed capabilities:**
The invoking developer controls the local CLI invocation or the client connected to the stdio MCP server. Repository inspection uses fixed Git operations, and validation commands run only when explicitly supplied by the caller. The caller is responsible for trusting those commands and any project scripts they execute. The developer must also trust the MCP client and the actions it is authorized to perform, since an AI agent can invoke exposed tools on the developer's behalf, including running validation commands without the developer manually entering them. Commands inherit the process’s permissions and environment; repository selection and execution limits are not a sandbox. Remote, multi-user, or untrusted-client deployments are outside this scope.
- **Reliability, discoverability, latency/context, and output tradeoffs:**
- **How supported interfaces remain consistent:**
- **Evidence that would change this decision:**
Actual usage favoring one interface, measured overhead (additional performance, maintenance, or resource costs), or demand for untrusted or remote deployments.

## How did you use an AI coding agent?

## Where did you check, correct, or reject an AI suggestion? (required)

## Commands used to verify the result, with outcomes
After making each proposed change, I run `npm run typecheck` and make sure it passes successfully. As a temporary local check, I also changed `input.repo_path` back to `input.repoPath` while keeping `any` removed. Typechecking rejected the wrong property as expected. I restored the correct field afterward. 

I run `npm run inspector -- review --repo "." --base-ref HEAD --validate "node -e process.exit(2)" --validate "node -p 42"` from project root and as expected:
- A report was generated.
- The first command was `failed`, exit code 2.
- The second command was `passed`, exit code 0 and output 42.

Verified both output streams by running `npm run inspector -- review --repo "." --base-ref HEAD --validate "node -e console.log(111),console.error(222)"`:

As expected:
- Status was `passed`.
- The report contained stdout 111 and stderr 222.
- Exit code was 0.

I ran each of these separately:

- npm run inspector -- review --repo "." --validate
- npm run inspector -- review --repo "." --format json
- npm run inspector -- review --repo "." --unknown

And as expected, each printed a clear error and exited nonzero; they did not generate or overwrite a report.

I also manually checked output limits and continuation by running:
`npm run inspector -- review --repo "." --base-ref HEAD --validate "node -e process.stdout.write(String.fromCharCode(120).repeat(1100000))" --validate "node -p 42"`

And as expected, the report showed:
- First command: failed, reason output-limit.
- Second command: passed, output 42.

And running `$LASTEXITCODE` immediately afterward gave the output of `1` which means a validation failed or the inspector encountered an error (as expected).

And lastly, I checked the build executable with the command:
`node .\dist\src\cli.js review --repo "." --base-ref HEAD --validate "node -p 42"`

And the result was as expected: a report and exit code 0 (`passed`).

## A blocker you hit and how you approached it

## Known limitations and the next three things you would do

**Known limitations:**
- Git inspection: Includes committed changes from the merge base of the selected base reference and `HEAD` to `HEAD`. Staged, unstaged, and untracked changes are excluded.
- Validation: Commands run against the current working tree rather than a snapshot of the committed changes being inspected. Consequently, validation results may reflect uncommitted modifications.
- Validation security: Validation commands execute with the permissions and environment of the inspector process. They are not sandboxed, so only trusted commands should be executed.
- Git parsing: renames and unusual filenames can be reported incorrectly.
- Markdown formatting: command output containing triple backticks can break report formatting.

## Approximate focused-work time

- Start:
- Finish: