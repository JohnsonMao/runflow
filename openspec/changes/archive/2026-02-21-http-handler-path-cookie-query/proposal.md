## Why

目前 http handler 只支援對 **body** 與 **header** 做替換（template substitution）；**path**（路徑區段）、**query**（查詢參數）、**cookie** 無法在 step 層指定或覆寫。因此無法在單一 step 內依 params 或前一步輸出動態組出完整 URL（path + query）或帶入 Cookie，動態 API 呼叫與需 path/query/cookie 的整合情境支援不足。

## What Changes

- http step 支援可選欄位 **path**、**query**、**cookie**，與既有 body、header 一樣由 executor 做 template 替換後傳給 handler。
- **path**：覆寫或補齊 URL 的 pathname（可含 path params），與 base url 組合成最終 url。
- **query**：覆寫或合併 URL 的 search（query string）；可為 key-value 或已編碼字串，由實作定義。
- **cookie**：寫入請求的 `Cookie` header（可與既有 `headers` 合併或覆寫），格式由實作定義（例如 key-value 或字串）。
- 現有欄位 **url**、**method**、**headers**、**body** 行為不變；未指定 path/query/cookie 時行為與今日一致，無 **BREAKING**。

## Capabilities

### New Capabilities

- 無。本 change 僅擴充既有 built-in http 的 step 形狀與行為。

### Modified Capabilities

- **config-handlers-openapi**: 擴充 built-in http handler 的 step 形狀：從 (url, method, headers, body) 擴充為可選的 **path**、**query**、**cookie**；文件需說明此 step shape 與 URL 組裝／Cookie 的語意，使 OpenAPI 產生的 step 與自訂 handler 可一致使用。

## Impact

- **packages/handlers**：`http.ts` 需讀取 step.path、step.query、step.cookie，組裝最終 URL 與 Cookie header，其餘流程不變。
- **packages/core**：若 FlowStep 型別有集中定義，需在型別上加入可選 path、query、cookie（或由 handlers 以 index signature 涵蓋）。
- **openspec/specs/config-handlers-openapi**：需新增或調整 requirement，描述 step shape 含 path、query、cookie 及與 url/headers 的優先順序。
- **Custom handlers**：依 config-handlers-openapi 載入的 custom handler（如 `handler: "../custom-api.mjs"`）目前接收 (url, method, headers, body)；若 spec 將 step shape 擴充為含 path/query/cookie，實作可選擇是否使用新欄位，未使用時行為與今日一致。
