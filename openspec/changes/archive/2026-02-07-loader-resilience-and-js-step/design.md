# Design: Loader resilience, CLI validation, JS step

## Context

- **Loader**: Currently uses `readFileSync` then `parse(content)`; no try/catch. Return type is `FlowDefinition | null`; parse already returns null for invalid content.
- **CLI**: Calls `loadFromFile(file)` then checks `if (!flow)` and exits with a generic message. No pre-check of file existence.
- **Steps**: Only `command` is supported; executor uses `execSync(run)` for each command step. Types and parser are command-only.

## Goals / Non-Goals

**Goals:**

- Loader never throws; all file/parse failures become `null`.
- CLI gives a clear "file not found" or "not a file" message when the path is bad, before calling core.
- Loader has unit tests (success + missing file + invalid content).
- New step type `js`: YAML `type: js`, `run: "<code>"`; executed in-process; same `StepResult` shape as command.

**Non-Goals:**

- Sandboxing or security isolation for js steps (run in Node with a simple context).
- Passing data between steps (e.g. shared state or previous step output); can be added later.
- Changing the existing `command` step behavior.

## Decisions

### Decision 1: Loader try/catch

- Wrap the entire body of `loadFromFile` in try/catch.
- On any exception (readFileSync throws, or parse could theoretically throw): return `null`.
- No logging inside loader; caller (CLI) is responsible for user-facing messages.

### Decision 2: CLI file check

- Before `loadFromFile(file)`:
  - Use `fs.existsSync(file)` and `fs.statSync(file).isFile()` (or equivalent) to ensure the path exists and is a regular file.
  - If not: `console.error('Error: File not found or not a regular file: <file>')` (or similar), `process.exit(1)`.
- This keeps core free of I/O assumptions and leaves UX in the CLI.

### Decision 3: JS step execution

- **Representation**: `FlowStepJs`: `{ id: string, type: 'js', run: string }`. Same `run` field name as command for consistency.
- **Execution**: Use Node's `vm.runInNewContext(code, context, options)` with a minimal context (e.g. `{ console }` so `console.log` works). Code is the `run` string; wrap in a function so we can catch return/throw. Alternatively use `new Function(code)()` with a provided `console`; prefer `vm` for a bit of isolation.
- **Output**: Override or pass a `console` that buffers log/warn/error to capture stdout/stderr and set on `StepResult`. If not capturing, stdout/stderr can be empty and only `success`/`error` matter.
- **Errors**: Any thrown value → catch, set `success: false`, `error: message`, optional stderr. Same `StepResult` shape as command.

### Decision 4: Constants and types

- Add `STEP_TYPE_JS = 'js'` in constants. Extend `FlowStep` as union `FlowStepCommand | FlowStepJs`. Parser and executor branch on `step.type`.
