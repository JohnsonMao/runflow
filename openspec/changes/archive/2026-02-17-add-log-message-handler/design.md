## Context

Runflow steps are executed by handlers in `@runflow/handlers`; each handler returns a `StepResult` with optional `log` for CLI `--verbose` and MCP display (step-result-log). The set handler currently sets `log` to "set keys: ...", blurring the line between "assign variables" and "emit a display line". Proposal: add a dedicated `message` step for logging and stop setting `log` in the set handler.

## Goals / Non-Goals

**Goals:**

- Introduce a `message` step type that emits a single log line (with template substitution), no context writes.
- Change set handler so it no longer sets `log` on StepResult; set remains purely for context assignment.

**Non-Goals:**

- Multi-line or structured logging; message is one string for display.
- Changing how executor or CLI/MCP consume `log` (step-result-log unchanged).
- New core types or executor behavior; only new handler and SetHandler change.

## Decisions

**1. Message step shape: `type: 'message'`, `message: string`**

- Rationale: Matches other steps (e.g. `set: { ... }`); one required field keeps YAML simple and template substitution applies to that string like other step fields.
- Alternative: A generic `log` step was considered; `message` is clearer and avoids overloading the word "log" (noun vs verb).

**2. Message handler: no outputs, only `stepResult(step.id, true, { log: substitutedMessage })`**

- Rationale: Message is for display only; no keys merged into context. Executor already applies template substitution to the step before calling the handler, so the handler receives the substituted `message` and passes it to `log`.
- Alternative: Handler could do substitution itself; rejected so message follows the same substitution semantics as set/other steps (executor is single place for substitution).

**3. Set handler: remove `log` from `stepResult` call**

- Rationale: Set is for assigning variables; display line was redundant and conflated with message. Call becomes `context.stepResult(step.id, true, { outputs: { ...set } })` with no `log` key.
- Alternative: Make set's log optional via a flag; rejected to keep set behavior simple and logging explicit via message step.

**4. Validation: message step requires `message` (string)**

- Handler `validate(step)` returns an error if `step.message` is missing or not a string, consistent with set's validation for `set` object.

## Risks / Trade-offs

- **Existing flows/tests that assert on set step log**: Any test or flow that expects "set keys: ..." in step output will break. Mitigation: Add a short migration note in proposal/impact; update in-repo tests and example flows when implementing.
- **No behavioral change to executor**: Executor and core types stay unchanged; only handlers package and built-in registry change. Low risk.
