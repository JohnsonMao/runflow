# Proposal: 擴充 FlowStep 的 outputKey，由 executor 統一處理 outputKey

## Why

目前 `outputKey` 的語意由各 handler 自行實作（例如 http handler 自己決定把回應寫入 `context[outputKey ?? step.id]`），導致邏輯分散且重複。若在 FlowStep 層級新增選用欄位 `outputKey`，並由 executor 在合併 step 結果到 context 時統一套用「有效 key = outputKey ?? id」，則所有 step 的輸出寫入規則一致，http handler 不需再處理 outputKey，只需回傳 `outputs` 內容即可。

## What Changes

- **FlowStep 擴充**：在 `packages/core` 的 FlowStep 型別與語意上，新增選用欄位：
  - `outputKey?: string`：寫入 context 時使用的 key；若未提供則使用 step 的 `id`（與現有 http 行為一致）。
- **Executor 行為**：合併 step 的 `StepResult.outputs` 到 context 時，一律使用 `effectiveKey = step.outputKey ?? step.id`，即 `context[effectiveKey] = outputs`。現行「只用 step id 當 key」的邏輯改為上述規則。
- **Http handler**：不再自行解讀 `step.outputKey` 或決定寫入 key；改為回傳單一物件形態的 `outputs`（例如 `{ statusCode, headers, body }`），由 executor 依 `outputKey ?? id` 寫入 context。
- 若有其他 handler 目前依賴「以 step id 為 key」的假設，需確認與新行為相容（多數情況相容，因預設仍為 id）。

## Capabilities

### New Capabilities

- （無：本變更為既有 step-context 與 http-request-step 行為的擴充與統一，不新增獨立 capability 檔案。）

### Modified Capabilities

- `step-context`：輸出的 context key 由「一律 step id」改為「step.outputKey 若存在則用 outputKey，否則用 step id」；並在 Purpose/Requirements 中說明 FlowStep 可選欄位 `outputKey` 的語意。
- `http-request-step`：移除「handler 自行依 outputKey 決定寫入 key」的實作與規格；改為依賴 executor 的統一 outputKey 邏輯，handler 僅回傳 response 物件作為 `outputs`。

## Impact

- **packages/core**：`types.ts` 的 FlowStep 註解/型別需提及 `outputKey`；`executor.ts` 在合併 step 結果到 context 的程式（目前以 `targetStepId` 為 key）改為使用 `step.outputKey ?? step.id`，且需能取得當前 step 的 `outputKey`（runStep 時已有 step 參考）。
- **packages/handlers**：`http.ts` 移除 outputKey 的讀取與傳遞，改為回傳單一 response 物件作為 `outputs`；`http.test.ts` 中關於 outputKey 的案例改為驗證「executor 寫入的 key」或保留行為驗證（透過 run 結果的 context 或下游 step 的 params）。
- **YAML / 現有 flow**：既有只使用 `id` 的 step 行為不變；已有 `outputKey` 的 http step 仍可沿用，改由 executor 解讀。
