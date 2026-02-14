# Design: Loop marker steps（loop start / iteration i/N 插在 body 之間）

## Context

Runflow 的 loop 目前行為：body 步驟由 executor 在 `runSubFlow` 內即時 push 到 `RunResult.steps`，loop 步驟本身則在 handler 回傳後才 push，且 loop 的 log 透過 `appendLog` 合併成單一 StepResult.log。因此 GUI/Server/CLI 若只依 `steps` 順序還原時間軸，會看到「body 輪1 → body 輪2 → … → loop step」，無法在 body 之間插入「loop start」「iteration 1/N」等標記。change **loop-closure-full-end-infer** 的 design 已描述此需求並建議採用 **選項 A（Marker / 合成 step）**；本 change 實作該方案。

現狀要點：

- **packages/core**：`StepContext` 有 `runSubFlow`、`stepResult`、`appendLog` 等；executor 在 `runSubFlow` 內每完成一個 body step 就 `steps.push(result)`，主迴圈最後 push 當前 step 的 result。
- **packages/handlers (loop)**：呼叫 `runSubFlow(bodyStepIds, ctx)` 多輪，每輪前/後可 `appendLog`，但無法在「body 步驟之間」插入獨立 step 紀錄。
- **契約**：`RunResult.steps` 為依執行順序的陣列；消費者希望依此即可還原時間軸，不需解析 loop step 的合併 log。

## Goals / Non-Goals

**Goals:**

- **StepContext 擴充**：提供 `pushMarkerStep?.(stepId: string, log: string)`（或等價 API），讓 handler 在適當時機將「僅含 stepId + log、success: true」的標記 step push 進主 `steps`。
- **Executor**：在建立 stepContext 時提供上述 API，實作上 push 到與 `runSubFlow` 相同的 `steps` 陣列，使 marker 與 body 步驟順序一致。
- **Loop handler**：在 loop 開始時 push marker「loop start」、每輪 `runSubFlow` 結束後 push「iteration i/N」、loop 結束時 push 或回傳「loop complete」；body 步驟維持即時 push，故 `steps` 順序為：start → body 輪1 → iter1 → body 輪2 → … → loop step（或最後一個 marker）。
- **單一契約**：`RunResult.steps` 即為依執行順序的完整列表，GUI/Server/CLI 依序渲染即可，不需虛擬插入或解析 log。

**Non-Goals:**

- 不改變 `runSubFlow` 的語意（earlyExit、scope、context 累積等）。
- 不強制其他 handler（如 flow）使用 marker；API 為可選，未提供時 handler 不呼叫即可。
- 不規定 marker 的 stepId 命名格式（可由 loop handler 自訂，例如 `loop._start`、`loop._iteration_1`）；僅規定「stepId + log」最小形狀。

## Decisions

### 1. StepContext 擴充：pushMarkerStep 為可選

- **Choice**：在 `StepContext` 上新增可選 `pushMarkerStep?: (stepId: string, log: string) => void`。Executor 在建立傳給 handler 的 context 時，若該次執行有主 `steps` 陣列（即 top-level run 或 runSubFlow 的 caller 所在 run），則注入實作：push 一筆 `StepResult` 形態為 `{ stepId, success: true, log }`（無 outputs、無 nextSteps）到該 `steps`。
- **Rationale**：與現有 `appendLog` 一致，採可選欄位；handler 可透過 `context.pushMarkerStep?.()` 安全呼叫。僅寫入 stepId + log 保持 marker 輕量，不參與 DAG/nextSteps。

### 2. Executor 注入時機與寫入目標

- **Choice**：Executor 在建構 `stepContext`（供主迴圈與 `runStepById` 使用）時，關閉 over 同一個 `steps: StepResult[]`；在該 context 上設定 `pushMarkerStep` 為一函式，其內執行 `steps.push({ stepId, success: true, log })`。`runSubFlow` 內呼叫 `runStepById` 時傳入的 sub-context 沿用同一 `stepContext.runSubFlow`，但 **也沿用同一 `stepContext` 的引用**，故 loop handler 拿到的 `context.pushMarkerStep` 與 `context.runSubFlow` 寫入的是同一個 `steps`。
- **Rationale**：確保 marker 與 body 步驟寫入同一陣列、同一順序；不需要在 runSubFlow 內再傳遞 pushMarkerStep，只要 loop 拿到的 context 來自 executor 且帶有 pushMarkerStep 即可。實作時需確認 runSubFlow 內建之 `runStepById` 傳給 body 步驟的 tempStepContext 是否需轉遞 pushMarkerStep（若 loop 只在「自己」的 run 內呼叫 pushMarkerStep，則 loop 的 context 已有 pushMarkerStep；body 內的 step 不需再 push marker，故可選是否轉遞）。

### 3. Loop handler 呼叫順序

- **Choice**：Loop handler 執行順序：(1) 進入時 `pushMarkerStep?.(markerIdStart, 'loop start')`；(2) 每輪：`runSubFlow(bodyStepIds, ctx)`，回傳後 `pushMarkerStep?.(markerIdIter, \`iteration ${i}/${n}\`)`；(3) 所有輪結束後 `pushMarkerStep?.(markerIdEnd, 'loop complete')`（或將「loop complete」僅放在本 step 的 result.log，視產品需求）；最後回傳 loop step 的 StepResult。Marker 的 stepId 由 handler 自訂（例如 `${step.id}._start`、`${step.id}._iteration_${i}`）以避免與真實 step id 衝突。
- **Rationale**：與 proposal 一致；「iteration i/N」在 runBody **之後** push 對應「每輪結束後再標記」，與 loop-closure-full-end-infer 的 Decision 5 一致，且 steps 順序即為 start → body 輪1 → iter1 → body 輪2 → …。

### 4. Marker 的 StepResult 形狀

- **Choice**：`pushMarkerStep(stepId, log)` 寫入的項目形態為 `{ stepId, success: true, log }`。不寫入 `outputs`、`nextSteps`；可選欄位皆可省略。
- **Rationale**：Marker 僅用於時間軸與顯示，不需參與 context 累積或 DAG；最小形態即可。若未來需讓 marker 出現在 context 中，可再擴充（本 change 不納入）。

### 5. runSubFlow 內 body 步驟的 context 是否帶 pushMarkerStep

- **Choice**：runSubFlow 內 `runStepById` 傳給 body 步驟的 `tempStepContext` **可** 轉遞 `pushMarkerStep`（與 stepContext 相同引用），如此一來若有 body 內 step 想插 marker（未來擴充）也可用；不轉遞則僅 loop（或上層 caller）可插 marker。本設計採 **轉遞**，實作簡單且一致。
- **Rationale**：轉遞不增加行為差異，且保留未來其他 handler 或巢狀結構使用 marker 的彈性。

## Risks / Trade-offs

- **步數增加**：每輪多一筆 marker（iteration i/N），loop 開始/結束各一筆，steps 筆數會增加。若迴圈次數很大，需注意 log/儲存量；可接受，因這是「依序還原時間軸」的明確取捨。
- **stepId 命名**：若 marker 的 stepId 與 flow 內真實 step id 重複，可能造成消費者混淆。Mitigation：loop handler 使用帶前綴或後綴的 id（如 `loop._start`、`loop._iteration_1`），並在 spec 或文件建議慣例。
- **向後相容**：僅新增可選 API 與 loop 行為擴充；未使用 pushMarkerStep 的 flow 行為不變。舊 MCP/CLI 若只依 stepId 過濾「真實」步驟，可選擇忽略 `stepId` 符合 marker 慣例的項目。

## Migration Plan

- **部署**：依序釋出 (1) packages/core（StepContext 型別 + executor 注入 pushMarkerStep）；(2) packages/handlers loop（在適當時機呼叫 pushMarkerStep）。無 DB 或 API 契約變更，僅 RunResult.steps 內容在「有 loop 且 handler 使用 marker」時多出項目。
- **Rollback**：若需關閉 marker，可改為不注入 pushMarkerStep 或 loop 不呼叫；既有消費者若依序渲染 steps 仍可運作，僅無「插在 body 之間」的標記。

## Open Questions

- 無。若產品希望「loop complete」也以 marker 呈現而非僅在 loop step 的 log，可於實作時在 loop handler 最後再 push 一筆 marker 並在 tasks 中註明。
