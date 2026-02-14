# flow-call-step (Delta): 子流程步驟攤平進主流程結果

## Purpose

執行 flow step 時，將子 flow 的 step 結果攤平進主流程的 RunResult.steps，stepId 帶前綴，使 MCP/CLI 顯示與 loop 一致（每步一行含 log）。

## ADDED Requirements

### Requirement: Flow step sub-flow steps SHALL be flattened into main RunResult.steps

When a flow step runs a callee flow and obtains a RunResult, the executor SHALL push each of the callee's `result.steps` into the main flow's `steps` array, so that each callee step appears as a separate entry in the final RunResult. Each flattened step's `stepId` SHALL be prefixed to avoid collision with the main flow, in the form `{parentStepId}.{childStepId}` (e.g. `sub.sub-set`). The parent flow step's own StepResult (e.g. stepId `sub`) SHALL remain in the main steps; the callee steps SHALL be pushed immediately after it, in order.

#### Scenario: Sub-flow steps appear in main result with prefixed stepId

- **WHEN** the main flow has a step `id: 'sub', type: 'flow', flow: 'sub.yaml'` and the callee flow has steps `sub-set`, `other`
- **THEN** after the flow step runs, the main RunResult.steps SHALL contain an entry for `sub` (the flow step itself) followed by entries with stepId `sub.sub-set` and `sub.other`
- **AND** each of those entries SHALL retain their success, log, outputs, and error from the callee run so that MCP/CLI formatRunResult shows one line per step with log when present

#### Scenario: Flattened step preserves log and success

- **WHEN** the callee step `sub-set` returns StepResult with `log: 'set keys: fromSub, receivedFrom'` and `success: true`
- **THEN** the main RunResult.steps SHALL include an entry with stepId `sub.sub-set`, `log: 'set keys: fromSub, receivedFrom'`, and `success: true`
- **AND** the formatter (e.g. MCP execute) SHALL display that line like any other step (e.g. `- ✓ sub.sub-set` and `log: set keys: ...`)

#### Scenario: Order is flow step then callee steps

- **WHEN** the main flow runs steps `init`, `sub` (flow step), `next`
- **THEN** the final RunResult.steps order SHALL be: steps for `init`; then the step for `sub`; then steps for `sub.{childStepId}` for each callee step in order; then steps for any subsequent main steps such as `next`
- **AND** the same ordering semantics SHALL apply as for loop (body steps inserted after the loop step)
