# step-context (Delta): appendLog 與 loop 生命週期 log

## Purpose

Handler 執行過程中可透過 `context.appendLog` 即時追加 log 行；executor 在 handler 回傳後將累積的 log 與 result.log 合併。用於 loop 的「開始、進行中（第幾次迭代）、完成」等生命週期 log。runSubFlow 的 body 步驟改為即時 push（不 buffer），使步驟依執行順序出現。

## ADDED Requirements

### Requirement: StepContext SHALL provide optional appendLog for lifecycle log lines

StepContext SHALL include an optional `appendLog?: (message: string) => void`. When the executor invokes a handler's run(), it SHALL provide an appendLog that appends the given string to a buffer for the current step. When the handler returns, the executor SHALL merge that buffer with the returned result.log (e.g. accumulated lines first, then result.log if present) and set the final result.log so that MCP/CLI display shows the full lifecycle (e.g. loop start, iteration 1/N, ..., loop complete).

#### Scenario: Handler appends log during execution

- **WHEN** a handler calls `context.appendLog?.('start')` at the beginning, `context.appendLog?.('iteration 1/3')` and similar during execution, and `context.appendLog?.('complete')` before returning with `result.log = 'iterations: 3'`
- **THEN** the StepResult for that step SHALL have log equal to the concatenation of accumulated lines and the returned log (e.g. "start\niteration 1/3\niteration 2/3\niteration 3/3\ncomplete\niterations: 3" or equivalent)
- **AND** the formatter SHALL display that log so that lifecycle and final summary are both visible

### Requirement: runSubFlow body results SHALL be pushed immediately when shouldBufferSubFlowResults is false

When a handler that invokes runSubFlow does not implement `shouldBufferSubFlowResults` or returns false, the executor SHALL push each body step result to the main steps array as soon as that body step completes (immediate push). The caller step's own result SHALL be pushed when the handler returns, so it may appear after its body steps in the final steps order.

#### Scenario: Loop body steps appear in execution order before loop step

- **WHEN** a loop step runs and its handler does not buffer (shouldBufferSubFlowResults omitted or false), and the body runs three iterations producing body step results R1, R2, R3
- **THEN** the main RunResult.steps SHALL contain R1, R2, R3 in that order, followed by the loop step's own result
- **AND** the loop step MAY use appendLog to record "loop start", "iteration 1/3", etc., and "loop complete" in its result.log
