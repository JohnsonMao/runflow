# Proposal: optimize-discover-display

## Why

discover 目前每次回傳都包含每筆 flow 的完整 description 與完整 params（含 OpenAPI body 所有欄位），在 flow 數量多或單筆 params 很大時，單次回應過長、不易掃描；且分頁時沒有明確引導如何取得下一批。優化顯示可讓清單易讀、取得細節可選，並補充分頁提示。

## What Changes

- **Tool 命名**：MCP 對外暴露三支 tool：
  - **discover_flow_list**：列出 flows 簡表（flowId、name；可選 type），支援 keyword、limit、offset；分頁時回傳結尾帶下一批取得方式之提示。
  - **discover_flow_detail**：依 flowId 回傳單筆 flow 的完整 description 與 params。
  - **executor_flow**：依 flowId 執行 flow（取代現有 `execute`）。**BREAKING**：既有 MCP 客戶端若依 tool 名稱 `execute` 呼叫，須改為 `executor_flow`。
- **清單與細節分離（方向 A）**：清單由 discover_flow_list 回傳簡表；細節由 discover_flow_detail(flowId) 取得，不再在清單中預設帶完整 params。
- **分頁引導**：discover_flow_list 當回傳筆數達 limit 且仍有後續筆數時，回傳結尾附加明確提示（例如「下一批：使用 discover_flow_list(offset=N) 取得第 M–K 筆」）。
- **視覺區分 type（可選）**：清單中是否標示每筆來源（file / openapi）由 design 決定。

## Capabilities

### New Capabilities

- 無。本 change 僅調整 discover 的輸出格式與參數語意，不新增獨立 capability。

### Modified Capabilities

- **mcp-server**：tool 名稱與職責變更為 discover_flow_list、discover_flow_detail、executor_flow（取代 discover、execute）。需求變更：(1) discover_flow_list 回傳簡表、分頁提示；(2) discover_flow_detail(flowId) 回傳單筆完整 description 與 params；(3) executor_flow 取代 execute 之執行語意；(4) 可選：清單標示 flow 來源 type。具體參數與 Markdown 格式於 specs 以 delta 補充。

## Impact

- **apps/mcp-server**：註冊三支 tool（discover_flow_list、discover_flow_detail、executor_flow）；discover_flow_list 之 format 與分頁邏輯；discover_flow_detail 之單筆詳情組裝；execute 更名為 executor_flow（含 description / inputSchema 對齊）。
- **openspec/specs/mcp-server**：以 delta 更新 tool 名稱、discover_flow_list / discover_flow_detail / executor_flow 之需求與分頁提示。
