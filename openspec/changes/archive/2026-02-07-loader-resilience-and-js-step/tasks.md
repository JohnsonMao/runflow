# Tasks

## 1. Loader resilience

- [x] 1.1 Wrap `loadFromFile` body in try/catch; on any exception return `null` (packages/core/src/loader.ts).

## 2. Loader tests

- [x] 2.1 Add `packages/core/src/loader.test.ts`: test loadFromFile with a real temp file (valid YAML) returns FlowDefinition.
- [x] 2.2 Test loadFromFile with nonexistent path returns null and does not throw.
- [x] 2.3 Test loadFromFile with path to file containing invalid flow (e.g. invalid YAML or missing name/steps) returns null.

## 3. CLI file validation

- [x] 3.1 In `flow run <file>` action, before calling loadFromFile: check file exists and is a file (e.g. existsSync + statSync().isFile()); if not, print clear error and process.exit(1) (apps/cli/src/cli.ts).

## 4. JS step type – types and constants

- [x] 4.1 Add `FlowStepJs` interface and extend `FlowStep` union in packages/core/src/types.ts.
- [x] 4.2 Add `STEP_TYPE_JS = 'js'` in packages/core/src/constants.ts.

## 5. JS step type – parser

- [x] 5.1 In parseStep, when type === STEP_TYPE_JS and run is string, return FlowStepJs; otherwise (js with invalid run) return null (packages/core/src/parser.ts).

## 6. JS step type – executor

- [x] 6.1 Implement runJsStep(stepId, code): run code with vm (or Function), capture console if desired, return StepResult with success/error and optional stdout/stderr (packages/core/src/executor.ts).
- [x] 6.2 In run(), iterate steps: for type 'command' call existing runCommandStep; for type 'js' call runJsStep; push each StepResult (packages/core/src/executor.ts).

## 7. Verify

- [x] 7.1 Run pnpm test and pnpm run check (typecheck + lint) and fix any failures.
- [x] 7.2 Manually run a flow that mixes command and js steps (e.g. add example to examples/ or use existing hello-flow with one js step).
