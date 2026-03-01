## 1. Types & Core Infrastructure

- [x] 1.1 Modify `StepResult.nextSteps` to be `string[] | null` in `packages/core/src/types.ts`.
- [x] 1.2 Modify `StepResultOptions.nextSteps` to be `string[] | null` in `packages/core/src/types.ts`.

## 2. Core Engine Refactoring

- [x] 2.1 Implement logic in `executeFlow` to detect `result.nextSteps === null` and immediately terminate `executeFlow`.
- [x] 2.2 Ensure all old `unconsumedNextSteps` and `earlyExit` related logic is removed from `executeFlow`.

## 3. Engine Test Updates

- [x] 3.1 Add a test case for `nextSteps: null` to verify flow termination in `packages/core/src/engine.test.ts`.
- [x] 3.2 Remove `subflowRunnerHandler` and its associated tests from `packages/core/src/engine.test.ts` as they are no longer relevant.

## 3. Loop Handler Refactoring

- [x] 3.1 Update `LoopHandler` in `packages/handlers/src/loop.ts` to use the new `unconsumedNextSteps` from `RunResult`.
- [x] 3.2 Implement "Early Exit" logic in `LoopHandler`: if `unconsumedNextSteps` exist, terminate iteration and return them.
- [x] 3.3 Update `LoopHandler` to handle "Round Complete" when `unconsumedNextSteps` is empty.

## 4. Verification & Testing

- [x] 4.1 Update `packages/core/src/engine.test.ts` to verify `unconsumedNextSteps` behavior.
- [x] 4.2 Update `packages/handlers/src/loop.test.ts` to verify the new iteration and early exit logic.
- [x] 4.3 Run all core and handler tests to ensure no regressions.
- [x] 4.4 Run E2E tests to confirm overall flow execution remains stable.
