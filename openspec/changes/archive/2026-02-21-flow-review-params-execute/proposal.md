# Proposal: flow-review-params-execute

## Why

Flow 列表或探索介面目前可列出 flow，但使用者點選單一 flow 時，除了看到流程結構外，還需要知道該 flow 可帶入的參數（params）並能填寫後手動執行，才能在 GUI 中完成「選 flow → 看流程與參數 → 執行」的完整體驗。此 change 確立「flow 檢視」介面需同時提供流程視覺化、params 展示與手動執行的能力。

## What Changes

- **Flow 檢視介面**：點擊某個 flow 時，介面須顯示該 flow 的流程圖（DAG）與可帶入的 params 宣告（名稱、型別、必填、預設、描述等），並提供手動填寫 params 後觸發執行的操作。
- **流程圖**：沿用既有 flow 圖格式（如 flow-graph-format 或 FlowDefinition）渲染，不變更既有視覺化規格。
- **Params 展示**：依 flow 或 discover 詳情中的 params 宣告（ParamDeclaration[]）顯示，供使用者填寫；執行時將使用者輸入的 params 傳給執行端（如 MCP executor_flow 或未來 GUI 後端）。
- **手動執行**：介面提供「執行」操作，將當前選取的 flowId 與使用者填寫的 params 傳給執行端，並顯示執行結果或錯誤。

## Capabilities

### New Capabilities

- **flow-review-ui**：Flow 檢視介面規格。定義當使用者選取單一 flow 時，介面須顯示該 flow 的流程圖、該 flow 可帶入的 params（依宣告展示並可編輯）、以及手動執行按鈕/操作；執行時以 flowId + params 呼叫執行端並呈現結果。不規定實作技術（可為 MCP 客戶端、Web 應用或未來 Runflow GUI）。

### Modified Capabilities

- （無。流程圖沿用 web-flow-visualization / flow-graph-format 的輸入；params 沿用 flow-params-schema 的宣告與驗證語意；執行沿用既有 executor 與 MCP executor_flow 的介面，不變更既有 spec 需求。）

## Impact

- **MCP 客戶端或未來 GUI**：需實作或擴充「flow 詳情」畫面，整合流程圖元件、params 表單與執行呼叫（如 executor_flow）。
- **資料來源**：flow 列表與詳情（含 params、steps）可由現有 discover_flow_list / discover_flow_detail 或 @runflow/workspace 的 buildDiscoverCatalog / getDiscoverEntry 取得；流程圖可由現有 flow view --output json 或等價 graph 資料提供。
- **執行**：透過既有 executor_flow（MCP）或 @runflow/core run() 執行，無需新增執行 API；params 驗證依 flow-params-schema 與 effectiveParamsDeclaration 語意。
