## 1. Core types

- [x] 1.1 In `packages/core/src/types.ts`, add optional `canBeDependedOn?: boolean` to `IStepHandler` with JSDoc: when false, only steps designated by this step (then/else for condition, entry/done for loop) may list this step in dependsOn; engine validates before run.

## 2. Validation

- [x] 2.1 In `packages/core`, add `validateCanBeDependedOn(flow: FlowDefinition, stepByIdMap: Map<string, FlowStep>, registry: StepRegistry): string | null`: for each step in the DAG whose handler has `canBeDependedOn === false`, compute allowed dependent ids from step shape (condition: then+else; loop: entry+done, reusing existing normalizeStepIds); for each step S that has this step in S.dependsOn, require S.id to be in allowed ids; return error message including violating step id(s) or null if valid.
- [x] 2.2 Call this validation from executor in `run()` after DAG validation and before the execution loop; on non-null return, return `RunResult { success: false, error: message, steps: [] }` (or equivalent).
- [x] 2.3 Ensure dry-run path also runs this validation and fails with the same error when invalid.

## 3. Handlers

- [x] 3.1 In `packages/handlers/src/condition.ts`, set `canBeDependedOn: false` on the condition handler (class or instance per interface).
- [x] 3.2 In `packages/handlers/src/loop.ts`, set `canBeDependedOn: false` on the loop handler.

## 4. Tests

- [x] 4.1 Core: add tests for validateCanBeDependedOn — valid: condition then/else and loop entry/done depend on designator; invalid: extra step depends on condition or loop, error message contains violating step id.
- [x] 4.2 Executor (or integration): run flow with invalid dependent fails before any step runs; run flow with valid condition/loop dependents succeeds; dry-run with invalid dependent fails with same error.
- [x] 4.3 Handlers: ensure condition and loop handlers expose canBeDependedOn false (unit test or type assertion).

## 5. Docs and check

- [x] 5.1 Update README or relevant spec if we document “who may depend on condition/loop” for authors.
- [x] 5.2 Run `pnpm run check` (typecheck, lint, test).
