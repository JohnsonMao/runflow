# Design: Step engine and nodes enhancements

## Context

Runflow executor runs steps in DAG order via a registry; each step is substituted with context then handed to the handler for its `type`. There is no step-level skip condition, timeout, or retry. Command uses `execSync` (no timeout/cwd/env); HTTP fails on non-2xx and does not retry; JS is sync-only and only plain-object returns become outputs. The proposal adds engine-level when/timeout/retry, extends command/http/js, and introduces sleep, set, loop. Constraints: FlowStep stays generic (`[key: string]: unknown`); handlers remain the single execution contract (custom-node-registry). **Loop step adopts a breaking change**: body/done run by executor as sub-flow; exactly one of items/count/until.

## Goals / Non-Goals

**Goals:**

- Implement engine when/timeout/retry so any step can opt in via optional fields.
- Extend command with timeout (seconds), cwd, env; HTTP with timeout, retry, always responseObject, success = no error, image→base64; JS with timeout, output-key, async.
- Add three new step types: sleep, set, loop, and register them in the default registry.

**Non-Goals:**

- Backoff strategies (e.g. exponential) for retry; only fixed retry count.
- Loop as only a fixed JS snippet per item (we adopt loop body as executor-driven sub-flow instead).
- Changing parser or YAML schema; all new fields are optional and already accepted as generic step keys (loop step shape is updated; existing loop YAML is breaking).

## Decisions

### 1. Engine: when evaluation

- **Choice**: Evaluate `when` in the executor using `runInNewContext`, same pattern as condition step: `(function(params){ return Boolean(${when}); })(params)` with `{ params: context }`.
- **Rationale**: Keeps semantics consistent with condition’s `when`; no new deps; expression runs in a sandbox with only `params`.
- **Alternatives**: Template-only (e.g. `when: "{{ env }} === 'prod'"` then eval) was rejected to keep flexibility of full expressions.

### 2. Engine: timeout

- **Choice**: Executor wraps `handler.run(substitutedStep, stepContext)` in `Promise.race(run(), timeoutPromise)`. Timeout value from `step.timeout` in **seconds**; timeout promise rejects with `Error('step timeout after Ns')`, caught and turned into a failed StepResult.
- **Rationale**: Single place for step timeout; handlers stay unaware. Seconds align with command’s timeout and human-readable YAML.
- **Alternatives**: Handler-level only (each handler implements timeout) would duplicate logic and miss custom handlers; engine-level only is chosen.

### 3. Engine: retry

- **Choice**: In the executor, after when-check and before/around the run: loop up to `(step.retry ?? 0) + 1` attempts. On each attempt run with timeout; on success break and push result; on failure retry; after last failure push the last StepResult.
- **Rationale**: Transparent to handlers; works for all step types. Default 0 retries preserves current behavior.

### 4. Skip result when `when` is false

- **Choice**: Push a StepResult with `success: true`, `stdout: ''`, `stderr: ''`, no `outputs`. Step is marked completed so DAG dependents still run.
- **Rationale**: Skipped step is “success” for flow semantics; no context pollution; execution order remains clear.

### 5. Command: timeout / cwd / env

- **Choice**: Use `child_process.exec` (promisified or callback wrapped in Promise) when `step.timeout` or `step.cwd` or `step.env` is present; options: `timeout: step.timeout * 1000`, `cwd: step.cwd`, `env: { ...process.env, ...step.env }`. Apply substitution to `step.env` values (and `step.cwd` if string). If none of these are set, keep using `execSync` for backward compatibility.
- **Rationale**: `execSync` has no timeout; Node’s `exec` supports `timeout`. Env merge with process.env is standard.

### 6. HTTP: timeout, retry, success, body

- **Choice**:
  - Timeout: `AbortController` + `setTimeout`; pass `signal` to `fetch`. Unit: **seconds** (align with engine and command).
  - Retry: loop inside handler; total attempts = `(step.retry ?? 1) + 1` (default 2). Retry on throw or optionally on any non-2xx (proposal says “success = no error”, so retry only on throw).
  - Always set `outputs[outputKey] = { statusCode, headers, body }`; set `success: true` if no throw (any status).
  - Body: if `Content-Type` matches `image/*` or `application/octet-stream`, read `response.arrayBuffer()`, then `Buffer.from(buf).toString('base64')`; store as string in `body`.
- **Rationale**: Call success “request completed”; 4xx/5xx still get responseObject for inspection. Base64 keeps binary serializable in JSON context.

### 7. JS: timeout, output-key, async

- **Choice**:
  - Timeout: take from `step.timeout` (number, **milliseconds**); default 10_000. Pass to `runInNewContext` options.
  - Output key: if `step.outputKey` is set, use it; else use `step.id`. If return value is plain object, merge into outputs as today; if not (primitive, array, etc.), set `outputs[outputKey] = value`.
  - Async: wrap code in `(async function(){ ... })()` and pass `Promise` into the VM context; `runInNewContext` returns a Promise; handler `await`s it and uses resolved value for outputs (same object vs outputKey rules).
- **Rationale**: outputKey matches HTTP (one key for the step’s result). Async enables async/await in user code without changing the handler interface.

### 8. Sleep step

- **Choice**: Single field `seconds` (number, required) or `ms` (number); support template substitution. Handler `await new Promise(r => setTimeout(r, durationMs))`; return success, no outputs.
- **Rationale**: Simplest; “seconds” is primary for YAML readability; “ms” optional for fine control.

### 9. Set step

- **Choice**: Required `set` (object). Executor already substitutes the step; handler just returns `outputs: { ...step.set }` (step is already substituted).
- **Rationale**: No handler logic beyond passing through; substitution is executor’s job.

### 10. Loop step: exactly one of items | count | until

- **Choice**: Loop step SHALL accept **exactly one** of: `items` (array), `count` (number), or `until` (condition step id). No optional `run` JS per item; no fixed execution order.
- **Rationale**: Single, clear driver for the loop; avoids ambiguous combinations. Replaces the previous “items + optional run” design.

### 11. Loop body as executor-run sub-graph; done as nextSteps (like condition then/else)

- **Choice**: Loop step has required `body` (array of step ids) and optional `done` (array of step ids). For each iteration, the **executor** runs the body as a **sub-flow** (same model: DAG, when/condition/nextSteps). **Done is not a sub-graph to run.** When the loop completes **normally** (items exhausted, count reached, or until indicates exit), the loop step’s StepResult SHALL have `nextSteps: done`, so the executor continues with those steps—same semantics as condition’s then/else.
- **Rationale**: Decouples loop from a fixed sequence; done is a branch target, not a second sub-run. Aligns with condition step’s nextSteps contract.

### 12. Loop early exit: use body’s nextSteps; do not run done

- **Choice**: When any body step returns `nextSteps` that include a step id **outside** the body, the engine SHALL treat this as **early exit**: stop the iteration, exit the loop, and complete the loop step with **that same nextSteps**. The executor continues with those steps. **Done is not run** on early exit.
- **Rationale**: Early exit and normal exit are two distinct branches: early exit uses the body step’s nextSteps; normal exit uses done as nextSteps. No “run done after early exit” to keep semantics clear.

## Risks / Trade-offs

- **[Risk] VM escape or heavy CPU in when/loop expressions** → Mitigation: reuse existing timeout (e.g. 2000 ms for when, step timeout for loop run); keep VM context minimal (params only).
- **[Risk] exec vs execSync for command** → Mitigation: use exec only when timeout/cwd/env present; otherwise keep execSync to avoid behavior change.
- **[Risk] HTTP retry on 4xx** → Mitigation: retry only on throw (network/timeout); do not retry on 4xx/5xx so “success = no error” stays clear.
- **[Trade-off] Image body always base64** → Larger context; acceptable for small images or when downstream needs a string. Document size implications.

## Migration Plan

- **Loop step**: BREAKING. Existing flows that use `type: loop` with the old shape MUST be updated to the new shape: exactly one of `items` | `count` | `until`, required `body`, optional `done` (nextSteps on normal completion); body run by executor as sub-flow; early exit returns body’s nextSteps, done not run.
- Other new fields (when/timeout/retry, new step types except loop) remain optional; existing flows without loop run unchanged.
- Rollback: remove new handler registrations and engine when/timeout/retry logic; revert handler changes; for loop, revert to previous spec if needed.

## Open Questions

- Units: HTTP timeout in seconds (align with engine) vs ms (align with JS) — proposed seconds for consistency with engine/command.
