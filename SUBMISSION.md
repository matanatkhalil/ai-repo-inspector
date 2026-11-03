# Submission

## What did you investigate first, and why?
Before changing any code, I ran the four baseline commands to understand the project's initial state and to identify any existing problems I could reproduce. The results were as follows:
- Baseline typecheck (`npm run typecheck`): passed.
- Baseline tests (`npm test`): passed (1 test). (Note: A subsequent test run with build output present discovered duplicate execution of the report test from both `test/report.test.ts` and `dist/test/report.test.js`. This did not provide additional behavioral coverage.)
- Baseline build (`npm run build`): passed.
- Dependency audit (`npm audit`): reported 15 vulnerabilities across the dependency tree.

The application passed all existing checks, providing a working baseline for further investigation. I noted the dependency vulnerabilities for later review, as I wanted to prioritize investigating the application's core functionality and potential issues within the codebase first, given the assessment's time constraints.

Next, I explored the existing application to understand its functionality and trace how the main components interact, from receiving user input to generating the review report.

I focused on:

- Execution flow: How the CLI and MCP interfaces interact with the shared core functionality.
- Git inspection: How the application identifies changed files and what changes are included in the review.
- Validation execution: How user-provided commands are executed and how failures are handled.
- Report generation: What information is included in the output and whether the results accurately reflect the inspection.

A few findings/observations in the starter implementation:
- MCP accepted `repo_path` but read `repoPath`.
- Failed validations aborted report generation, and `stdout || stderr` could discard stderr.
- Git inspected committed branch changes, while validation ran against the working tree.
- CLI paths containing spaces were truncated, and JSON was accepted but not implemented.

This investigation helped me understand the existing behavior, identify potential correctness, reliability, and security risks, and establish what the product is supposed to do, which risks matter most, and what I should prioritize improving within the available time. I treated the product as a deterministic Git-change inspection and validation tool, running explicitly requested validations and producing a report. 

## What did you choose to implement or fix?
I corrected repository selection across CLI and MCP by fixing the MCP input mapping, preserving CLI paths containing spaces, and rejecting missing or blank paths in the shared core. I changed validation execution to collect failures, preserve stdout and stderr, continue with later commands, and display statuses, exit codes, and diagnostics in reports. The CLI writes the report before returning a nonzero exit status when validations fail, while MCP returns the completed report containing those failures. 

I added a 120-second per-command timeout that requests subprocess termination and an explicit 1 MiB output-buffer limit per stream. Timeout and output-limit failures are classified and reported. I also tightened input validation, rejected unsupported JSON output, corrected the built executable path, and excluded compiled tests from discovery. 

I added focused regression and CLI/MCP integration tests. Configurable limits and comprehensive cross-platform process-tree cleanup remained outside scope.

## What did you intentionally not do?
I retained inspection of committed changes from the merge base of the selected base reference and `HEAD` to `HEAD`. I did not add staged, unstaged, or untracked inspection modes because they would require additional Git handling and tests. 

I also deferred JSON output, robust rename/unusual-filename parsing, Markdown escaping, configurable execution limits, and comprehensive process-tree cleanup. I prioritized verifying the shared reliability fixes instead.

## Interface decision

- **Decision: Hybrid, scoped to trusted local development.**
I chose hybrid because the starter already separates the adapters from shared review logic, which allows core fixes to benefit both developers and coding agents. Since the starter already supports both interfaces, retaining them while sharing the same core logic avoids duplicating the review logic, while still requiring contract tests for each adapter. My planned scope prioritized a narrow shared contract and adapter integration tests rather than adding separate capabilities to each interface. Both adapters use the shared review pipeline, with equivalent repository-selection behavior and validation execution policies. 
- **Primary user and execution environment:**
The primary users are **local developers and their coding agents**. I assumed a **trusted local environment** where the tool runs with the developer’s OS permissions and the caller explicitly supplies any validation commands.
- **Trust boundary and allowed capabilities:**
The invoking developer controls the local CLI invocation or the client connected to the stdio MCP server. Repository inspection uses fixed Git operations, and validation commands run only when explicitly supplied by the caller. The caller is responsible for trusting those commands and any project scripts they execute. The developer must also trust the MCP client and the actions it is authorized to perform, since an AI agent can invoke exposed tools on the developer's behalf, including running validation commands without the developer manually entering them. Commands inherit the process’s permissions and environment; repository selection and execution limits are not a sandbox. Remote, multi-user, or untrusted-client deployments are outside this scope.
- **Reliability, discoverability, latency/context, and output tradeoffs:**
Sharing the core helps keep CLI and MCP behavior consistent, but supporting both requires testing each interface. Developers can use the CLI instructions, while AI clients can discover the MCP tool and its inputs. The CLI starts a process for each review, whereas the MCP server can stay running; I did not measure the performance difference. CLI reports are saved to a file, while MCP reports are sent directly to the client. I limited command output to reduce excessively large results although the total report size is not capped.
- **How supported interfaces remain consistent:**
Both adapters call the same core and Markdown formatter. Integration tests compare their reports for equivalent requests against a separate temporary repository. Common input rules and validation policies are enforced in the core. Transport behavior remains different: the CLI writes a file and sets its exit status; MCP returns the report as text. Failed validations are review results, while invalid repositories are operational errors.
- **Evidence that would change this decision:**
Low MCP usage or excessive adapter maintenance could justify CLI-first. Predominantly protocol-based users could justify MCP-first. Furthermore, measured overhead (additional performance, maintenance, or resource costs) or demand for untrusted or remote deployments would also make me reconsider the decision. 

## How did you use an AI coding agent?

I used an AI coding agent, namely GPT-6.1 Sol (Medium) within OpenCode, to map the architecture, identify reproducible defects, propose focused fixes, implement approved changes, and add regression and adapter integration tests. I used typechecking, manual CLI checks, and automated tests to verify the changes. I challenged its initial interface recommendation rather than accepting the proposed scope unchanged.

## Where did you check, correct, or reject an AI suggestion? (required)

The AI agent initially recommended CLI-first and deferring MCP support to reduce implementation scope. I challenged this because the starter already shared review logic across both adapters and targeted developers and coding agents. I chose a hybrid interface scoped to trusted local development, retained MCP, and verified equivalent behavior through adapter integration tests. This avoided removing a useful interface solely to simplify the assessment.

I checked the suggestion to remove `input: any` by temporarily restoring the incorrect `input.repoPath` access. Typechecking rejected it, confirming that inferred input types would catch the original mapping mistake. I then restored `input.repo_path`.

## Commands used to verify the result, with outcomes
After making each proposed change, I ran `npm run typecheck` and confirmed that it passed successfully. As a temporary local check, I also changed `input.repo_path` back to `input.repoPath` while keeping `any` removed. Typechecking rejected the wrong property as expected. I restored the correct field afterward. 

I ran `npm run inspector -- review --repo "." --base-ref HEAD --validate "node -e process.exit(2)" --validate "node -p 42"` from the project root and as expected:
- A report was generated.
- The first command was `failed`, exit code 2.
- The second command was `passed`, exit code 0 and output 42.

I verified both output streams by running `npm run inspector -- review --repo "." --base-ref HEAD --validate "node -e console.log(111),console.error(222)"`:

As expected:
- Status was `passed`.
- The report contained stdout 111 and stderr 222.
- Exit code was 0.

I ran each of these separately:

- `npm run inspector -- review --repo "." --validate`
- `npm run inspector -- review --repo "." --format json`
- `npm run inspector -- review --repo "." --unknown`

As expected, each printed a clear error and exited nonzero; they did not generate or overwrite a report.

I also manually checked output limits and continuation by running:
`npm run inspector -- review --repo "." --base-ref HEAD --validate "node -e process.stdout.write(String.fromCharCode(120).repeat(1100000))" --validate "node -p 42"`

And as expected, the report showed:
- First command: failed, reason output-limit.
- Second command: passed, output 42.

Immediately afterward `$LASTEXITCODE` returned the output of `1`, confirming the inspector’s nonzero exit status (meaning a validation failed or the inspector encountered an error, as expected).

Finally, I checked the built executable with the command:
`node .\dist\src\cli.js review --repo "." --base-ref HEAD --validate "node -p 42"`

The result was as expected: a report and exit code 0 (`passed`).

Final check of all standard commands passed:
- `npm run typecheck`: Passed
- `npm run build`: Passed
- `npm test`: 9 tests passed across 4 test files

The tests cover repository selection with paths containing spaces, shared input rejection, stdout/stderr preservation, continuation after failures, output limits, timeout classification, report statuses, and actual CLI/MCP behavior. The timeout regression uses a fake clock with real subprocess I/O, rather than waiting 120 seconds.

## A blocker you hit and how you approached it
Halfway through the project, my VS Code editor showed missing Node types (`node:fs` and `process`). These missing Node APIs were reported in `cli.ts`. I checked command-line typechecking and confirmed the dependencies were installed: typechecking passed and `@types/node` was present; therefore, this suggested an editor/project-resolution issue rather than a code defect. To solve this, I switched VS Code settings to the workspace TypeScript version to align editor diagnostics with the project’s compiler. And as a result, those red error lines disappeared from `cli.ts`. 

## Known limitations and the next three things you would do

**Known limitations:**
- Timeout handling: The tool requests that a validation stop after 120 seconds, but it does not guarantee that all programs started by that command stop. Some may continue running and delay the report.
- Git inspection: Includes committed changes from the merge base of the selected base reference and `HEAD` to `HEAD`. Staged, unstaged, and untracked changes are excluded.
- Validation: Commands run against the current working tree rather than a snapshot of the committed changes being inspected. Consequently, validation results may reflect uncommitted modifications.
- Validation security: Validation commands execute with the permissions and environment of the inspector process. They are not sandboxed, so only trusted commands should be executed.
- Git parsing: renames and unusual filenames can be reported incorrectly.
- Markdown formatting: command output containing triple backticks can break report formatting.

**The next three steps:**
1. Improve timeout cleanup so programs started by a validation are also stopped reliably on supported operating systems.
2. Improve Git filename parsing so renames and filenames containing unusual characters are reported correctly.
3. Improve report formatting so special characters and backticks in command output do not break the Markdown layout.

## Approximate focused-work time

The implementation and verification phase took approximately 90 focused minutes:

- Start: 13:00, 3 November 2026 (AZT)
- Finish: 14:30, 3 November 2026 (AZT)

I also spent time investigating the codebase before this phase, across several sessions on 2–3 November. Completing the documentation (`SUBMISSION.md` and `README.md`) took a few additional hours, including breaks. I did not track the focused time for these earlier activities separately.
