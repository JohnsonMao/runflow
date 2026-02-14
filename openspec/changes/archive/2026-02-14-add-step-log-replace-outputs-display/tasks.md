# Tasks: add-step-log-replace-outputs-display

## 1. Core types and stepResult

- [x] 1.1 In `packages/core/src/types.ts`, remove `stdout` and `stderr` from `StepResult`; add optional `log?: string` with JSDoc. Remove `stdout`/`stderr` from `StepResultOptions`; add `log?: string`.
- [x] 1.2 In `packages/core/src/stepResult.ts`, stop setting stdout/stderr; set `out.log = opts.log` when provided.

## 2. MCP server

- [x] 2.1 In `apps/mcp-server/src/index.ts`, change `formatRunResult`: for each step output only success badge, stepId, and if present `error` and `log`; remove stdout, stderr, and outputs from the formatted text.
- [x] 2.2 Update MCP server tests: remove stdout/stderr from StepResult fixtures; ensure formatRunResult tests pass with new shape.

## 3. CLI

- [x] 3.1 In `apps/cli/src/cli.ts`, change `--verbose` loop to output `step.log` (if present) to process.stdout instead of step.stdout/step.stderr.
- [x] 3.2 In `apps/cli/src/cli.test.ts`, update inline handler code to return `log` instead of `stdout`/`stderr`; keep assertions that expect step output to appear on process.stdout (now from log).

## 4. Tests and fixtures

- [x] 4.1 In `packages/core/src/executor.test.ts`, remove or replace assertion on `result.steps[0].stdout`.
- [x] 4.2 In `packages/handlers/src/loop.test.ts`, remove `stdout` and `stderr` from all mock StepResult objects in runSubFlow results.
- [x] 4.3 In `packages/core/src/validateCanBeDependedOn.test.ts`, remove stdout/stderr from stub handler return values.

## 5. Handlers: set log (optional)

- [x] 5.1 In `packages/handlers`, for each of set, condition, loop, http, flow, sleep: when returning stepResult(..., { outputs, ... }), add a short `log` string (e.g. set: keys; condition: branch; loop: iterations; http: method+url+status; flow: path+result; sleep: duration). Failure paths may rely on `error` only.

## 6. Check

- [ ] 6.1 Run `pnpm run check` (typecheck, lint, test).
