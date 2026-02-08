## 1. Context and path resolution

- [x] 1.1 Extend StepContext (types.ts) with optional `runFlow?: (filePath: string, params: Record<string, unknown>) => Promise<RunResult>` so the flow handler can invoke another flow without importing executor (avoids circular dependency).
- [x] 1.2 Add default max flow-call depth constant (e.g. DEFAULT_MAX_FLOW_CALL_DEPTH = 32) in constants.ts; extend RunOptions with optional `maxFlowCallDepth?: number`.
- [x] 1.3 In executor, when building StepContext, provide `runFlow` that: (1) resolves path relative to `flowFilePath` (or cwd), (2) checks current depth < maxFlowCallDepth (else resolve with a failed RunResult or throw so handler can return StepResult failure), (3) calls loadFromFile then run(flow, { params, flowFilePath, flowCallDepth: currentDepth + 1 }) so nested run has correct depth; executor tracks and passes flowCallDepth through run options / internal state.
- [x] 1.4 Add unit tests for path resolution (relative from flowFilePath dir, absolute, missing file).

## 2. Flow step handler

- [x] 2.1 Add FlowHandler class in packages/core/src/handlers/flow.ts implementing IStepHandler: validate step has `flow` string; run: substitute step (executor already does), resolve path, call context.runFlow(path, params), merge callee step outputs into StepResult.outputs, map success/error from RunResult.
- [x] 2.2 Implement validate: return string error when `flow` is missing or not a string; optional check for params being an object when present.
- [x] 2.3 Register `flow` handler in createDefaultRegistry (registry.ts).

## 3. Outputs and error handling

- [x] 3.1 In FlowHandler.run, collect outputs from RunResult.steps (each StepResult.outputs), merge with later-overwrites into one object, set as StepResult.outputs.
- [x] 3.2 When RunResult.success is false or runFlow throws, return stepResult(id, false, { error: RunResult.error or message }); ensure stderr/error is set so caller can see failure reason (covers callee load/run failure and **params validation failure** when callee has params declaration).

## 4. Flow-call depth limit and validation

- [x] 4.1 In executor (or runFlow implementation), pass and maintain flowCallDepth: 0 at top-level run; when runFlow is invoked, require currentDepth < maxFlowCallDepth, then run sub-flow with flowCallDepth = currentDepth + 1; when currentDepth >= maxFlowCallDepth, do not run sub-flow and return failed RunResult (or signal so handler returns StepResult with error "max flow-call depth exceeded").
- [x] 4.2 Add tests: flow step at depth below limit runs; flow step at depth (max-1) that would run callee at depth max returns success: false and error mentioning depth; run with maxFlowCallDepth: 2 and two levels of flow-call, second level fails with depth error.

## 5. Tests and integration

- [x] 5.1 Add flow.test.ts: scenarios from flow-call-step spec (valid flow step runs callee, relative path resolution, absolute path, params passed, outputs merged, load failure, callee run failure, template substitution for flow and params, depth below limit, depth exceeded, **callee params declaration: valid params pass, invalid params yield StepResult failure with validation error**).
- [x] 5.2 Add executor integration test: flow with a step type `flow` that calls a second flow file, verify combined result and context for subsequent steps.
- [x] 5.3 Run pnpm lint and vitest in packages/core; fix any regressions.
