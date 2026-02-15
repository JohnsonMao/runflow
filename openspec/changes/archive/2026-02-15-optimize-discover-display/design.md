# Design: optimize-discover-display

## Context

- MCP server 目前對外兩支 tool：`execute`（依 flowId 執行）、`discover`（列出 flows，回傳每筆含 flowId、name、description、完整 params）。discover 使用既有 cached catalog（flowsDir YAML + OpenAPI），支援 keyword、limit、offset。
- 痛點：discover 單次回傳過長（尤其 OpenAPI flow 的 body params 全展開），分頁無明確引導；執行用 tool 名稱與 discover 命名風格不一致。
- 約束：沿用既有 catalog 建置邏輯與 @runflow/core 執行語意；不向後相容，直接替換 tool 名稱。

## Goals / Non-Goals

**Goals:**

- 對外僅暴露三支 tool：`discover_flow_list`、`discover_flow_detail`、`executor_flow`。
- discover_flow_list 回傳簡表（flowId、name、type），分頁時結尾帶下一批取得方式之提示。
- discover_flow_detail(flowId) 回傳單筆完整 description 與 params（path/query/body，body 展開）。
- executor_flow 取代 execute，語意不變（flowId + 可選 params）。
- 清單可掃描、細節按需取得，分頁可操作。

**Non-Goals:**

- 不保留 `execute` 或 `discover` 之 alias；不向後相容。
- 不變更 catalog 建置時機或 invalidation 策略。
- 不新增 MCP Resources。

## Decisions

### 1. Tool 命名與註冊

- **決策**：註冊三支 tool：`discover_flow_list`、`discover_flow_detail`、`executor_flow`。移除對 `discover`、`execute` 的註冊。
- **理由**：語意分離（list / detail / run），命名一致；與 proposal 一致，不向後相容。

### 2. discover_flow_list 輸出格式

- **決策**：回傳 Markdown。第一行總數與範圍（Total: N flows. Showing start–end.）；可選一行說明 flowId 與 type 語意；接著以 **Markdown 表格** 一筆一列，欄位：`flowId` | `name` | `type`。type 為 `file` 或 `openapi`（依 flowId 是否含 `-` 且非路徑斜線區分，或於建 catalog 時寫入 source）。當 `offset + limit < total` 時，表格後附加一行分頁提示：「下一批：使用 discover_flow_list(offset=N) 取得第 M–K 筆」（N、M、K 為實際數字）。
- **理由**：表格利於掃描；type 區分 file/openapi 有助辨識來源；分頁提示明確，利於人類與模型。

### 3. discover_flow_detail 參數與輸出

- **決策**：單一必填參數 `flowId`。從既有 catalog 依 flowId 查詢；若不存在則回傳簡短錯誤說明（Markdown）。若存在則回傳該筆之 name、description、params（與現行 discover 單筆區塊相同格式：path/query/body，body 子欄位展開）。
- **理由**：與 proposal 方向 A 一致；實作可共用現有 formatParamsSummary / formatOneParam 與 catalog 查詢。

### 4. executor_flow 與 execute 語意

- **決策**：executor_flow 的 inputSchema 與行為與現有 execute 完全相同（flowId 必填，params 可選）；僅 tool 名稱改為 `executor_flow`，description 改為對應描述。
- **理由**：執行邏輯不變，僅對外名稱變更。

### 5. Catalog 與 type 來源

- **決策**：catalog 建置邏輯不變。在 DiscoverEntry 或等價結構中增加 `source: 'file' | 'openapi'`（建 catalog 時：檔案型為 file，OpenAPI 產生的為 openapi）。discover_flow_list 表格使用此欄位作為 type 欄。
- **理由**：最小改動；type 不需推斷，建檔時即確定。

## Risks / Trade-offs

- **[Risk] 既有客戶端呼叫 execute / discover 會失效** → 不緩解；明確不向後相容，需更新客戶端為 executor_flow / discover_flow_list / discover_flow_detail。
- **[Risk] 清單僅 flowId/name/type，模型若需 description 才能選 flow** → 可再呼叫 discover_flow_detail(flowId) 取得；必要時可在 list 加一欄 description 摘要（例如首句或前 80 字），本設計先以簡表為主，若實務需要再於 spec 補充。
- **[Trade-off] 兩次呼叫才能取得「清單＋某筆細節」** → 換取單次 list 回應簡短與可掃描性，符合方向 A。

## Migration Plan

- 實作完成後：部署新 MCP server 版本即可；無資料遷移。
- 所有依 MCP tool 名稱呼叫的客戶端（如 Cursor、腳本）須改為使用 `executor_flow`、`discover_flow_list`、`discover_flow_detail`。建議在 CHANGELOG 或 release notes 註明 breaking change。

## Open Questions

- 無。type 已決策納入清單；分頁提示格式已定。
