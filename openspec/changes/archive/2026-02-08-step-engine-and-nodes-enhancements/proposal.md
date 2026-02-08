# Proposal: Step engine and nodes enhancements

## Why

Flows need better control over step execution (skip conditions, timeouts, retries) and richer built-in steps for common patterns (delay, set context, loop). Existing steps (command, http, js) lack options like timeout/cwd/env, HTTP retry and consistent success/output semantics, and JS async + output-key. Adding engine-level when/timeout/retry and new step types makes flows more robust and expressive without pushing everything into custom JS.

## What Changes

- **Engine layer (all steps)**
  - Step-level `when`: optional JS expression; if false, step is skipped (not run, success for DAG).
  - Step-level `timeout`: optional number (seconds); step fails if execution exceeds.
  - Step-level `retry`: optional number of retries on failure; executor retries before marking failed.

- **Command step**
  - Optional `timeout` (seconds), `cwd`, `env` (object, merged with process.env). Template substitution applies to string values in env.

- **HTTP step**
  - Optional `timeout` (ms or seconds TBD), `retry` (default 1 = one retry, two attempts total).
  - Always return `responseObject` (statusCode, headers, body) in outputs; success = request completed without network/runtime error (any status code).
  - Binary/image responses: when Content-Type is image/* (or binary), body as base64 string so it is serializable in context.

- **JS step**
  - Optional `timeout` (ms, configurable; default remains 10s), `output-key` (same semantics as HTTP: key under which return value is written; when absent, use step id for object spread or single key for non-object return).
  - Support async: allow async/await in code; handler awaits the returned Promise and uses resolved value as outputs.

- **New step types**
  - `sleep`: delay for N seconds (or ms); supports template in duration.
  - `set`: declarative context write; `set: { key: value }` with full template substitution; no script.
  - `loop`: **exactly one of** `items` | `count` | `until`; required `body` (step ids, run by executor as sub-graph each iteration); optional `done` (step ids). **Done is nextSteps** on normal completion (like condition then/else). **Early exit**: body step returns nextSteps outside body → loop step completes with that nextSteps; done is **not** run.

**BREAKING (loop only)**: Loop step shape changes. Existing loop YAML (e.g. `items` + optional `run` only) must be updated to the new shape. Other new fields remain optional.

## Capabilities

### New Capabilities

- `engine-step-when`: Step-level skip condition (`when` expression); executor evaluates before run and skips step if false.
- `engine-step-timeout`: Step-level execution timeout (seconds); executor wraps handler run and fails on timeout.
- `engine-step-retry`: Step-level retry count; executor retries failed step up to N times before recording failure.
- `sleep-step`: Step type `sleep` with duration (seconds or ms), template-supported.
- `set-step`: Step type `set` with `set` object (key-value), template substitution on values.
- `loop-step`: Step type `loop` with exactly one of items | count | until; required `body` (sub-graph run by executor); optional `done` (returned as nextSteps on normal completion, like condition then/else); early exit returns body’s nextSteps and does not run done.

### Modified Capabilities

- `command-step`: Add optional `timeout`, `cwd`, `env`; behavior when present defined in spec.
- `http-request-step`: Add optional `timeout`, `retry`; require always returning responseObject in outputs; success = no network/runtime error; define image/binary body as base64.
- `js-step-type`: Add optional `timeout`, `output-key`; require support for async code (Promise return); output-key semantics for object vs non-object return.

## Impact

- **packages/core**
  - `executor.ts`: when evaluation, timeout wrapper, retry loop; optional skip result (success, no outputs).
  - `handlers/command.ts`: timeout (exec with timeout), cwd, env.
  - `handlers/http.ts`: timeout (AbortSignal), retry loop, always responseObject, success semantics, image → base64 body.
  - `handlers/js.ts`: configurable timeout, outputKey, async IIFE + await.
  - New handlers: `sleep.ts`, `set.ts`, `loop.ts`. **Executor**: loop step invokes a sub-run over body step set each iteration (same engine: DAG, condition, nextSteps); on normal exit loop returns nextSteps: done; on early exit loop returns the body step’s nextSteps (done not run).
  - `registry.ts`: register sleep, set, loop.
- **Parser**: No change (generic step keys already accepted).
- **Types**: FlowStep remains extensible (`[key: string]: unknown`); no new required fields.
- **CLI**: No change unless we expose step timeout/retry in dry-run or logs.
- **Examples**: New example flows for sleep, set, loop and updated http/js examples.
