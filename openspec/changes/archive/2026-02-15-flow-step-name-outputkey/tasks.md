## 1. Core types and docs

- [x] 1.1 In `packages/core/src/types.ts`, document FlowStep optional `outputKey` in the FlowStep interface comment (engine-reserved; outputKey used by executor for context key when merging outputs)
- [x] 1.2 Optionally add explicit `outputKey?: string` to FlowStep type for clarity and static checking

## 2. Executor: effective output key

- [x] 2.1 In `run()`, when merging each step result into context, use effectiveKey = `(step && typeof step.outputKey === 'string') ? step.outputKey : result.stepId` and assign `context[effectiveKey] = outputs` (obtain step via stepByIdMap.get(result.stepId))
- [x] 2.2 In `runStepByIdImpl`, when building newContext from result.outputs, use effectiveKey = `(st && typeof st.outputKey === 'string') ? st.outputKey : targetStepId` and set `newContext[effectiveKey] = outputs`
- [x] 2.3 In `runSubFlowImpl`, when merging batch results into currentCtx (both the reduce inside early-exit and the final reduce), use each step's effectiveKey (stepByIdMap.get(r.stepId).outputKey ?? r.stepId) instead of r.stepId

## 3. Http handler

- [x] 3.1 In `packages/handlers/src/http.ts`, remove reading of step.outputKey and the outputKey parameter to doRequest; return StepResult with outputs set to the response object directly (e.g. `outputs: responseObject`), not wrapped under a key
- [x] 3.2 Update http unit tests: keep or adjust tests that assert context key (default id vs explicit outputKey) so they verify behavior via executor (e.g. run a small flow and assert context/params), or keep handler tests asserting only that outputs shape is the response object and add/integration test that executor writes to the correct key

## 4. Verification

- [x] 4.1 Run `pnpm run check` (typecheck, lint, test) and fix any failures
- [x] 4.2 Manually or with a small flow YAML verify: step without outputKey → context[id]; step with outputKey → context[outputKey]; http step with outputKey still works for downstream steps
