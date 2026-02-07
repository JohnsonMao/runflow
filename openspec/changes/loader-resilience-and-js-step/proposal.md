# Proposal: Loader resilience, CLI validation, and JS step type

## Why

1. **Loader**: `loadFromFile` uses `readFileSync` without try/catch; missing or unreadable files cause raw Node exceptions instead of a clean null and CLI error message.
2. **CLI**: No early check that the flow file path exists before calling core; failing fast with a clear message improves UX.
3. **Tests**: `loader.ts` has no unit tests; adding them keeps parity with parser and executor and guards the new behavior.
4. **Flow engine**: Flows currently support only `command` steps (shell). Adding a `js` step type allows running inline JavaScript in-process alongside shell commands, enabling expressions and small scripts without spawning `node -e`.

## What Changes

- **Loader**: Wrap `readFileSync` in try/catch; on any read/parse failure (ENOENT, permission, invalid YAML), return `null` so callers get a consistent contract.
- **CLI**: Before `loadFromFile`, check that the given path exists and is a file; if not, print a clear error and exit(1).
- **Tests**: Add `loader.test.ts` covering: successful load, missing file → null, unreadable/invalid → null (or error path).
- **Core types**: Add `FlowStepJs` (`type: 'js'`, `run: string`), extend `FlowStep` union.
- **Parser**: Accept step `type: 'js'` with `run` string; validate and emit `FlowStepJs`.
- **Executor**: For `type === 'js'`, run the `run` string as JavaScript in-process (e.g. `vm.runInNewContext` or `new Function`), capture success/failure and optional stdout/stderr, return `StepResult`.

## Capabilities

### New Capabilities

- **Loader resilient to file errors**: `loadFromFile(path)` returns `null` when the file is missing or unreadable instead of throwing.
- **CLI file validation**: `flow run <file>` fails immediately with a clear message when the file path does not exist or is not a file.
- **Loader test coverage**: Unit tests for `loadFromFile` (success and failure cases).
- **JS step type**: Flow steps can use `type: js` with a `run` string containing JavaScript; the engine executes it in-process and reports success/failure (and optionally stdout/stderr).

### Modified Capabilities

- **Flow definition**: Step type union extended from `command` only to `command | js`.
- **Run result**: Steps may now be either command or js execution results, with the same `StepResult` shape.

## Impact

- `packages/core/src/loader.ts`: try/catch, return null on error.
- `packages/core/src/loader.test.ts`: new file, tests for loadFromFile.
- `packages/core/src/types.ts`: add FlowStepJs, extend FlowStep.
- `packages/core/src/constants.ts`: add STEP_TYPE_JS.
- `packages/core/src/parser.ts`: parse `type: 'js'` steps with `run` string.
- `packages/core/src/executor.ts`: run js steps in-process, append StepResult.
- `apps/cli/src/cli.ts`: early existsSync/stat check for run <file>.
