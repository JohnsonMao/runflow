# Proposal: discover-flows-openapi-cache-markdown

## Why

- **統一來源**：discover 目前只掃 flowsDir 下的 .yaml，未納入 config.openapi 產生的 flow；使用者無法一次看到「檔案型 + OpenAPI 型」所有可執行 flow。
- **效能與一致**：每次 discover 都遞迴掃檔並逐檔 loadFromFile，在 flow 數量多時耗時；且與 execute 使用的 flowId 語意（含 prefix-operation）未完全對齊。改為「載入設定後一次建好清單並暫存」可讓查詢一致、回應更快。
- **回傳格式**：目前回傳純 JSON，MCP 客戶端（如 Cursor）若要以易讀方式呈現，需自行轉成表格或列表。改為 Markdown 並納入 **params**（該 flow 可接受參數摘要），方便使用者挑選 flow 並知道要傳哪些參數。

## What Changes

- **載入時機**：載入設定（runflow config）之後，除 flowsDir 下的 .yaml 外，也將 config.openapi 的每個前綴對應的 spec 解析成 flow（與現有 openApiToFlows / resolveFlowId 語意一致）。
- **暫存**：上述兩類 flow（檔案型 + OpenAPI 型）在記憶體中暫存；discover 查詢時從暫存篩選，不再每次掃檔/解析。
- **查詢**：支援既有 `keyword` 篩選（檔名或 flowId、flow name、description）；keyword 可套用在兩類 flow 上。`limit` 仍限制回傳筆數。
- **回傳格式**：
  - 回傳欄位：**flowId**（檔案路徑或 prefix-operation）、**name**、**description**、**params**（該 flow 的 params 宣告摘要，若無則省略或空）。
  - 以 **Markdown 文字**呈現（例如表格），而非僅 JSON。

## Capabilities

### New Capabilities

- **discover 回傳 params**：每筆 flow 的 params 摘要（來自 flow YAML 的 `params` 或 OpenAPI 產生的 flow 的 params），供客戶端顯示「此 flow 可接受哪些參數」。
- **discover 回傳 Markdown**：tool 的 text content 為 Markdown（如表格），利於 MCP 客戶端直接渲染。

### Modified Capabilities

- **mcp-server discover tool**：來源改為「設定載入後之暫存清單」（flowsDir YAML + OpenAPI 產生的 flow）；回傳內容改為 flowId、name、description、params，並以 Markdown 呈現。

## Impact

- **apps/mcp-server**：實作「建暫存清單」（flowsDir 掃檔 + 每 prefix 呼叫 openApiToFlows）、discover 改為從暫存篩選並組 Markdown；需能取得每 flow 的 params（@runflow/core FlowDefinition.params）。
- **openspec/specs/mcp-server**：以 delta 補充 discover 的暫存、OpenAPI 來源、回傳欄位與 Markdown 格式。
- **依賴**：沿用 @runflow/config、@runflow/convention-openapi、@runflow/core；無新套件。
