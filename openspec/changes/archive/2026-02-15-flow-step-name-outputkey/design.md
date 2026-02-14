# Design: FlowStep outputKey 與 executor 統一寫入 context

## Context

- Runflow 的 step 輸出目前由 executor 以 `context[stepId] = outputs` 寫入；http handler 則自行解讀 `step.outputKey` 並在回傳的 `outputs` 裡用該 key 包一層，等於「寫入 key」的邏輯分散在 core 與 handler。
- FlowStep 型別目前僅在註解中列舉 engine-reserved 欄位（id, type, dependsOn, skip, timeout, retry），其餘為 handler 自由欄位。outputKey 若提升為 engine 層級，executor 即可依「約定好的 step 形狀」決定寫入 key，core 無須依賴 `step.type` 或個別 handler 行為。
- 目標：單一責任——寫入 context 的 key 只由 executor 依 FlowStep 的 `outputKey` / `id` 決定；handlers 只負責產出 `outputs` 內容。

## Goals / Non-Goals

**Goals:**

- 在 FlowStep 語意與型別上正式支援選用欄位 `outputKey`。
- Executor 合併 step 結果到 context 時，一律使用 `effectiveKey = step.outputKey ?? step.id`，且僅依 FlowStep 欄位（不依 step.type）。
- Http handler 不再處理 outputKey，只回傳 response 物件作為 `outputs`；其他 handler 行為不變（預設仍為 id）。

**Non-Goals:**

- 不改變 StepResult 的結構（仍為 outputs 物件）。
- 不在此 change 內重構其他 handler 的輸出格式；僅統一「寫入 context 的 key」由 executor 決定。

## Decisions

1. **effectiveKey 在 executor 的 merge 處計算**
   - 在 `run()` 的合併迴圈中，對每個 `result` 用 `stepByIdMap.get(result.stepId)` 取得 step，再算 `effectiveKey = (step && typeof step.outputKey === 'string') ? step.outputKey : result.stepId`，寫入 `context[effectiveKey] = outputs`。
   - 理由：單一處負責 key 的決定，不把 key 放進 StepResult，避免 handler 與 executor 重複約定。

2. **FlowStep 型別與註解**
   - 在 `types.ts` 的 FlowStep 註解中明確列出 `outputKey?` 為 engine 認識的選用欄位；型別已為 `[key: string]: unknown`，可加 `outputKey?: string` 以利文件與靜態檢查。
   - 理由：與現有「engine-reserved vs handler-specific」慣例一致，且不破壞既有 YAML。

3. **Http handler 簡化**
   - Handler 回傳 `outputs` 為單一物件（例如 `{ statusCode, headers, body }`），不再在 handler 內做 `outputKey` 或 `step.id` 的 key 包裝；寫入 context 的 key 完全由 executor 依 `outputKey ?? id` 處理。
   - 理由：消除重複邏輯，並讓「寫入 key」的規格只存在 step-context / executor。

4. **Core 不依 step.type 決定 context key**
   - 合併時僅依 step 的 `id` 與 `outputKey`（FlowStep 形狀），不依 `step.type` 分支。Registry 仍以 `step.type` 做 handler 查表，但「用哪個 key 寫入 context」與 type 無關。
   - 理由：符合 runflow-core 規範（core 不依 step type 解讀 step 內容）；outputKey 為約定好的 step 形狀之一。

## Risks / Trade-offs

- **向後相容**：既有 flow 未使用 `outputKey` 時行為不變（key 仍為 id）。已使用 `outputKey` 的 http step 改由 executor 解讀，YAML 不需改。
- **runStepByIdImpl / runSubFlowImpl**：若其內也有「用 stepId 寫入 context」的邏輯，需一併改為 `step.outputKey ?? stepId`，以維持與頂層 run() 一致。

## Migration Plan

- 依序實作：core types 註解 → executor 合併邏輯（含 runStepByIdImpl / runSubFlow 內若有寫入 context）→ http handler 移除 outputKey 處理、調整測試。
- 無資料遷移；現有 YAML 與既有執行結果相容。

## Open Questions

- 無。若後續有 handler 需要「多個 key 寫入」（例如一個 step 寫入多個 context key），可再討論是否擴充 StepResult 或保留由單一 effectiveKey 包一層物件的現狀。
