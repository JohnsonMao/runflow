# Design: discover-flows-openapi-cache-markdown

## Context

- **Current state**: discover 每次被呼叫時都會從 config.flowsDir 遞迴掃 .yaml、逐檔 loadFromFile，並只回傳 path / name / description 的 JSON；不包含 OpenAPI 產生的 flow，也不回傳 params。
- **Constraint**: 與 execute 的 flowId 語意一致（檔案路徑與 prefix-operation）；暫存生命週期與現有 config cache 一致（process 生命週期，不實作 config 熱重載）。
- **Stakeholders**: MCP 客戶端（如 Cursor）、使用者希望一次看到所有可執行 flow 並知道參數。

## Goals / Non-Goals

**Goals:**

- discover 來源為「設定載入後建好的暫存清單」，包含 flowsDir 下所有有效 YAML flow 與 config.openapi 每個 prefix 的 openApiToFlows 結果。
- discover 支援 keyword、limit；回傳內容為 flowId、name、description、params，並以 Markdown 呈現。

**Non-Goals:**

- Config 熱重載或暫存失效機制；暫存與 config 同壽。
- 改變 execute tool 或 flowId 解析邏輯。

## Decisions

### 1. 暫存資料結構與建檔時機

- **Chosen**: 在「取得 config 之後」建一份 `DiscoverEntry[]`，每筆為 `{ flowId, name, description?, params?: ParamDeclaration[] }`（或等價結構）。flowId 對檔案型為「相對 flowsDir 或絕對路徑」（與 execute 解析用同一規則）；對 OpenAPI 型為 `prefix-operation`（operation 為 convention-openapi 的 OperationKey，如 `GET /path`）。
- **建檔時機**: 與 config 綁定；可在第一次呼叫 discover 時 lazy 建檔（依當時 getConfig() 的 config + configDir），並在記憶體中快取此清單（例如掛在與 config 同一個 cache 的擴充結構，或獨立變數）。若無 config 重載，同一 process 內不重建。
- **Rationale**: 避免每次 discover 都掃檔與解析 OpenAPI；與現有 getConfigAndRegistry 的 cache 模式一致。

### 2. 檔案型 flowId 在 discover 回傳中的形式

- **Chosen**: 回傳給客戶端的 flowId 以「execute 可接受的形式」為準：相對路徑時為相對 config.flowsDir（或 cwd）的路徑，與 resolveFlowId 解析時使用的 baseDir 一致。實作上可用 path.relative(baseDir, filePath) 得到相對 path，或保留絕對路徑（execute 也接受絕對路徑）。
- **Rationale**: 客戶端可直接把回傳的 flowId 傳給 execute，無需再轉換。

### 3. OpenAPI 型 flow 的 flowId 與暫存建檔

- **Chosen**: 對每個 config.openapi 的 prefix，呼叫 openApiToFlows(specPath, { output: 'memory', ...entry 的 options })。Map 的 key 為 OperationKey（如 `GET /users`）；flowId 為 `${prefix}-${operation}`（與 resolveFlowId 的比對方式一致）。將每個 flow 的 name、description、params 與 flowId 一併放入暫存清單。
- **Rationale**: 與 execute 的 resolveFlowId(flowId) 語意一致，客戶端拿到的 flowId 可直接用於 execute。

### 4. params 的來源與呈現

- **Chosen**: 來自 FlowDefinition.params（@runflow/core）。YAML 檔有 top-level params 則已解析；OpenAPI 轉成的 flow 若 convention 有寫入 params 則一併納入。Markdown 中可摘要為「參數名 (type, required?)」或簡表；實作可選「只列 name/type」以保持簡潔。
- **Rationale**: 單一真相來自 core 的 flow 定義，不需重複解析。

### 5. Markdown 格式

- **Chosen**: 以 Markdown 表格為主：列為 flow，欄為 flowId | name | description | params。params 欄可為「name (type), ...」或「無」；若單格過長可考慮截斷或換行。無 flow 時回傳一句說明（如 "No flows found."）。
- **Rationale**: 表格在 Cursor 等客戶端渲染良好，且規格已要求「Markdown 文字」。

### 6. Keyword 篩選

- **Chosen**: 與現行一致：keyword 小寫、對 flowId、name、description 做 includes 比對（case-insensitive）。暫存清單建好後，filter 在記憶體中完成。
- **Rationale**: 行為與原 discover 一致，僅資料來源改為暫存。

## Implementation notes

- **apps/mcp-server**: 新增「建 discover 暫存」的函式，依 config 與 configDir 掃 flowsDir（沿用 findFlowFiles）+ 對每個 openapi prefix 呼叫 openApiToFlows；合併兩類為 DiscoverEntry[] 並快取。discoverTool 改為：取暫存 → 依 keyword 篩選 → 依 limit 截斷 → 將每筆轉成表格列（含 params 摘要）→ 組成 Markdown 表格字串回傳。
- **flowId 字串**: 檔案型建議回傳相對 baseDir 的路徑（與 CLI 一致）；OpenAPI 型為 `${prefix}-${operationKey}`（operationKey 可能含空格，需與 resolveFlowId 一致）。
- **錯誤處理**: 某個 openApiToFlows 失敗時可略過該 prefix（log 或靜默），不影響其他 prefix 與檔案型 flow。
