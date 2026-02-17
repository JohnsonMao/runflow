## 1. Message handler implementation

- [x] 1.1 Create `packages/handlers/src/message.ts` with `MessageHandler`: `validate(step)` requires `step.message` to be a string; `run(step, context)` returns `context.stepResult(step.id, true, { log: step.message })` with no outputs
- [x] 1.2 Export `MessageHandler` from `packages/handlers/src/index.ts` and add `message: new MessageHandler()` to `createBuiltinRegistry()`

## 2. Set handler: remove log

- [x] 2.1 In `packages/handlers/src/set.ts`, change `stepResult` call to omit `log` (return only `{ outputs: { ...set } }`)

## 3. Tests

- [x] 3.1 Add unit tests for MessageHandler: literal message returns log; invalid or missing message fails validate or returns success: false
- [x] 3.2 Update or remove any set handler tests that assert on step result `log` (e.g. "set keys: ...")

## 4. Spec and dependent docs (if needed)

- [x] 4.1 If `openspec/specs/flow-call-step/spec.md` or other specs assert set step log text, update scenario to not expect log from set steps (or note that sub-flow set steps no longer produce log)
