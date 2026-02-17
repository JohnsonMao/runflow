## Why

Flows need a dedicated step type to emit human-readable log lines (e.g. for CLI `--verbose` and MCP display) without writing to context. Today, the set handler fills `log` with "set keys: ...", which mixes "assign variables" with "show a message"; set should only assign, and logging should be explicit via a message step.

## What Changes

- Add a new step type **`message`** with a dedicated handler that returns a StepResult whose `log` is the step's message (optionally after template substitution). No outputs merged into context.
- **Set handler**: Stop setting `log` on StepResult. Set steps will still return `success: true` and `outputs`; only the `log` field is removed so that "set" is not used as a logging mechanism.

## Capabilities

### New Capabilities

- `message-step`: Step type `message` with a required `message` field (string). The handler runs template substitution on the message and returns `stepResult(step.id, true, { log: substitutedMessage })`. No outputs. Enables flows to emit one-line log lines explicitly.

### Modified Capabilities

- `set-step`: Set step handler SHALL NOT set `log` on StepResult. Outputs and success semantics unchanged; only the optional log line is removed so set is purely for context assignment.

## Impact

- **packages/handlers**: New `MessageHandler` and `message.ts`; `SetHandler` no longer passes `log` to `stepResult`. `createBuiltinRegistry()` gains `message: new MessageHandler()`.
- **openspec/specs**: New `message-step/spec.md`; delta for `set-step` (e.g. in change's `specs/` or main set-step) stating set handler does not set log.
- **Flows / tests**: Any flow or test that asserts on set step's `log` (e.g. "set keys: ...") will need to be updated to not expect that string; consider adding a `message` step where logging is desired.
