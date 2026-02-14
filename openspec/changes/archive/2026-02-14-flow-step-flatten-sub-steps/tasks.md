# Tasks: flow-step-flatten-sub-steps

## 1. Core: StepContext.appendLog 與 executor 累積合併

- [x] 1.1 In `packages/core/src/types.ts`, add to `StepContext`: optional `appendLog?: (message: string) => void`. JSDoc: when provided by executor, handler may call during run to append log lines; executor merges them with result.log when handler returns.
- [x] 1.2 In `packages/core/src/executor.ts`, before calling handler.run for a step, create an array for accumulated log and set `stepContext.appendLog = (msg) => { array.push(msg) }`. When handler returns, if array non-empty, set `result.log = [...array, result.log].filter(Boolean).join('\n')`.

## 2. Core: StepResult.subSteps 與 stepResult()

- [x] 2.1 In `packages/core/src/types.ts`, add optional `subSteps?: StepResult[]` to `StepResult` and `StepResultOptions` with JSDoc: when present, executor flattens into main steps with stepId prefix `{parentStepId}.{childStepId}`.
- [x] 2.2 In `packages/core/src/stepResult.ts`, set `out.subSteps = opts.subSteps` when provided.

## 3. Core: Executor 攤平 subSteps

- [x] 3.1 In `packages/core/src/executor.ts`, after `steps.push(result)` (in the main loop over batchResults), if `result.subSteps?.length`, push each `s` with `steps.push({ ...s, stepId: `${result.stepId}.${s.stepId}` })`.

## 4. Core: runSubFlow 依 shouldBuffer 決定 buffer；loop 不 buffer

- [x] 4.1 Keep `shouldBufferSubFlowResults` on IStepHandler; executor already uses it. In `packages/handlers/src/loop.ts`, **remove** `shouldBufferSubFlowResults` (or set to return false) so that loop body results are pushed immediately in runSubFlow, not buffered.
- [x] 4.2 Optionally rename or document: when shouldBuffer is false (default), body steps are pushed as they complete; loop step result is pushed when handler returns (so it appears after its body steps).

## 5. Handlers: loop 使用 appendLog 寫入開始 / 迭代 / 完成

- [x] 5.1 In `packages/handlers/src/loop.ts`, at start of run(): `context.appendLog?.('loop start')`. Before or after each iteration: `context.appendLog?.(\`iteration ${index + 1}/${total}\`)` (or equivalent). Before returning (success or early exit): `context.appendLog?.('loop complete')` (or 'loop complete (early exit)' when applicable). Keep final result.log as summary (e.g. `iterations: N`) so it appears after the accumulated lines.

## 6. Handlers: flow 回傳 subSteps

- [x] 6.1 In `packages/handlers/src/flow.ts`, when returning from runFlow (success or failure), set `subSteps: result.steps` on the StepResult so the executor can flatten them with prefix.

## 7. Tests

- [x] 7.1 Loop: body steps appear in RunResult.steps in execution order; loop step appears after its body steps; loop step log contains "loop start", "iteration i/N", and "loop complete" (or equivalent).
- [x] 7.2 Flow: run a flow with a flow step calling a sub-flow; assert RunResult.steps includes parent step and `parent.child` entries; assert log/success preserved.
- [x] 7.3 No `step.type === 'loop'` or `step.type === 'flow'` in executor (grep or lint).

## 8. Check

- [x] 8.1 Run `pnpm run check` (typecheck, lint, test).
