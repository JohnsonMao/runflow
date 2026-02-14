# Design: flow 攤平、loop 即時 push + 生命週期 log

## Context

你要的是：**即時 push 執行的步驟**（不先 buffer 再依序 push），同時需要 **loop 的開始、進行中與完成** 的 log——也就是在執行開始時補一筆 log、執行過程中補「目前第幾次迭代」的 log、以及最後執行完成的 log。

**約束**：Executor 不依 `step.type` 做分支；由 handler 介面與 StepContext 約定表達。

## Goals / Non-Goals

**Goals:**

- **即時 push**：runSubFlow 的 body 步驟結果**不 buffer**，每跑完一筆就立刻 push 進主流程 `steps`。因此 loop 的 body 會依執行順序出現在 steps 裡（loop 這一步則在 handler 回傳後才 push，會出現在其 body 之後）。
- **Loop 生命週期 log**：透過 **StepContext.appendLog**，在 loop 開始時、每輪迭代、以及結束時由 handler 主動 append 一行 log；executor 在 handler 回傳後把這些累積的 log 與 result.log 合併成該 step 的 log，讓 MCP/CLI 顯示「開始 → 迭代 1…N → 完成」。
- **攤平子步驟**：StepResult 支援可選 `subSteps?: StepResult[]`；executor 在 push 該 StepResult 後，依序 push 子 step 並將 stepId 改為 `{parentStepId}.{childStepId}`。Flow handler 回傳 `subSteps: result.steps`，使子 flow 步驟一筆一筆出現。
- **不依 type 分支**：是否 buffer 仍由 `shouldBufferSubFlowResults` 決定；**loop 改為不實作或回傳 false**，使 body 即時 push。Core 內無 `step.type === 'loop'` / `step.type === 'flow'`。

**Non-Goals:**

- 不恢復「先 buffer 再依序 push」的 loop 行為；順序改為：body 先出現，loop 一步最後出現（或依你指定順序的後續擴充）。
- 不要求其他 handler 使用 appendLog；僅 loop 需要生命週期 log 時使用。

## StepContext.appendLog

- **StepContext**（types.ts）：新增可選 `appendLog?: (message: string) => void`。由 executor 在呼叫 handler.run 前綁定一組「當前 step 的 log 緩衝」；handler 在執行過程中可多次呼叫 `context.appendLog?.('...')`，每一行會被累積。
- **Executor**：在 runOneStepInWave（或等同位置）呼叫 handler 前，建立 `accumulatedLog: string[]` 與 `appendLog = (msg: string) => { accumulatedLog.push(msg) }`，並傳入 stepContext。當 handler 回傳 result 後，若 `accumulatedLog.length > 0`，將 `result.log` 設為 `[...accumulatedLog, result.log].filter(Boolean).join('\n')`（先顯示生命週期 log，再顯示 handler 回傳的最後一行）。
- **Loop handler**：在 run() 開始時呼叫 `context.appendLog?.('loop start')`；每輪迭代開始或結束時呼叫 `context.appendLog?.(`iteration ${i + 1}/${total}`)`（或等價文案）；在 return 前呼叫 `context.appendLog?.('loop complete')`（或由最後一次 iteration 後統一 append）。最終回傳的 result.log 可為 `iterations: N` 等摘要，與累積的 start/iteration/complete 一併顯示。

## runSubFlow：即時 push，不 buffer（loop）

- **shouldBufferSubFlowResults**：保留介面，但 **Loop handler 改為不實作**（或回傳 false）。如此 executor 在 runSubFlow 內 `shouldBuffer === false`，body 的每個 result 即時 `steps.push(result)`，不再寫入 pendingLoopBodyResultsByStepId。
- **Executor**：若某 step 有 pendingLoopBodyResultsByStepId（即舊的 buffer 邏輯），可保留分支但僅在 `shouldBuffer === true` 時寫入；loop 改為 false 後，該分支對 loop 不再觸發。主迴圈中「先 push loop 再 push pending body」的邏輯仍可保留，只是 loop 不會再產生 pending body，改為 body 已即時 push，最後只 push 該 step 自己的 result。

## StepResult.subSteps（flow 攤平）

- 與前設計一致：StepResult / StepResultOptions 新增 `subSteps?: StepResult[]`；executor 在 push 該 result 後，若存在 subSteps 則依序 push `{ ...s, stepId: `${result.stepId}.${s.stepId}` }`。Flow handler 回傳時設 `subSteps: result.steps`（來自 runFlow 的 RunResult）。

## 測試要點

- 即時 push：loop 的 body 步驟在 RunResult.steps 中依執行順序出現，且「loop」這一步出現在其 body 之後。
- Loop 生命週期 log：該 loop step 的 log 包含「loop start」、多行「iteration i/N」、以及「loop complete」（或等價），與 handler 回傳的摘要合併顯示。
- Flow 攤平：主 flow 含 flow step 呼叫 sub-flow 時，steps 含 `sub` 與 `sub.sub-set` 等，log 保留。
- Core 無 step.type 分支：executor 內無 `step.type === 'loop'` / `step.type === 'flow'`。
