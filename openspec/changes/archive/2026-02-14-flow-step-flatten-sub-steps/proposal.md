# Proposal: flow 攤平、loop 即時 push 與生命週期 log

## Why

1. **Flow 攤平**：目前 `type: flow` 的 step 執行子 flow 後只回傳一個 StepResult，子 flow 各 step 不會出現在主流程的 `RunResult.steps`；需要攤平並加 stepId 前綴，使子步驟一筆一筆顯示。
2. **Loop 即時 push**：需要**即時 push** 執行的步驟（不先 buffer 再依序 push），body 步驟依執行順序出現在 steps 中。
3. **Loop 生命週期 log**：需要 loop 的**開始、進行中、完成**的 log——執行開始時補一筆 log、執行過程中補「目前第幾次迭代」、以及最後執行完成的 log。

## What Changes

- **StepContext.appendLog**：新增可選 `appendLog?: (message: string) => void`；handler 執行過程中可多次呼叫，executor 累積後與 result.log 合併，用於 loop 的 start / iteration i/N / complete。
- **runSubFlow 不 buffer（loop）**：Loop 改為不實作 `shouldBufferSubFlowResults`（或回傳 false），body 步驟結果即時 push；loop 這一步在 handler 回傳後 push，故會出現在 body 之後。
- **Flow 攤平**：StepResult 支援 `subSteps?: StepResult[]`；executor 在 push 該 result 後依序 push 子 step，stepId 前綴 `{parentStepId}.{childStepId}`。Flow handler 回傳 `subSteps: result.steps`。

## Capabilities

### New Capabilities

- **flow-step-flatten-sub-steps**：執行 flow step 時，子 flow 的 steps 攤平進主 RunResult.steps，stepId 帶前綴；MCP/CLI 顯示與 loop 一致，每步一行。

### Modified Capabilities

- **@runflow/core**：executor 在處理 flow step 的執行結果時，若 handler 回傳的結果包含子 RunResult（或由 executor 呼叫 runFlow 並取得），則將子 flow 的 steps 依序 push 進主 steps，並為每個 stepId 加上前綴。
- **@runflow/handlers**（若採用 handler 回傳子 steps）：flow handler 可能需回傳額外資訊供 executor 攤平；或由 executor 直接呼叫 runFlow 並在 core 內攤平，flow handler 僅回傳合併後的 outputs（依設計擇一）。

## Impact

- **@runflow/core**：executor 需在 flow step 完成後取得子 RunResult.steps，並以 `{parentStepId}.{childStepId}` 形式 push 進主 steps；可能需 runFlow 由 executor 注入並回傳子 result，或 flow handler 回傳子 steps 清單供 executor 攤平。
- **既有 flow**：無須改 YAML；僅執行結果的 steps 列表會多出子步驟列。
- **MCP/CLI**：無須改 formatRunResult；攤平後自然每步一行含 log。
