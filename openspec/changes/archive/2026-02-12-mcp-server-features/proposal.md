# Proposal: mcp-server-features

## Why

MCP Server 目前只接受檔案路徑（flowPath）、不讀取 runflow 設定檔，與 CLI 的 run/params 行為不一致。CLI 已支援單一參數 flowId（檔案路徑或 prefix-operation）、設定檔的 flowsDir 與依前綴區分的 openapi（specPath、hooks）。讓 MCP 採用相同設定與 flowId 語意，可達成「一個 flowId 走天下」、並與 CLI 共用同一份 runflow.config，方便在 Cursor 等 MCP 客戶端用相同方式指定要執行的 flow。

## What Changes

- **MCP execute tool**（原 run_flow）：參數由 `flowPath` 改為 `flowId`。flowId 可為：
  - 檔案路徑（絕對或相對 config.flowsDir / cwd）；
  - 或 OpenAPI 產生的 flow：`prefix-operation`（例如 `my-api-get-users`），由 config 的 openapi 區塊依前綴解析。
- **MCP 讀取 runflow.config**：與 CLI 共用同一設定檔（runflow.config.mjs、runflow.config.js 或 runflow.config.json）。支援：
  - `flowsDir`：解析「檔案型 flowId」時的根目錄（相對 config 目錄）；
  - `openapi`：以「前綴」為 key，每個前綴對應一組 `specPath` 與 `hooks`（及可選 baseUrl、operationFilter）；OpenAPI flow 的 flowId 為 `前綴-operation`。
- **discover tool**（原 list_flows）：可依 config 的 flowsDir 作為預設搜尋目錄（若未傳入 directory 且 config 有 flowsDir）。
- **統一命名**：run flow 與 openapi 的參數不再分開用 flowPath / operation，一律使用 flowId；設定檔的 openapi 改為「前綴 → spec path + hooks」的對應，flowId 由前綴與 operation 組裝。Tool 名稱改為 **execute**（執行 flow）與 **discover**（列出 flows）。
- **BREAKING**：MCP 執行 flow 的 tool 由 `run_flow` 改為 `execute`、參數由 `flowPath` 改為 `flowId`；列出 flows 的 tool 由 `list_flows` 改為 `discover`。既有客戶端需改用新 tool 名稱與參數。

## Capabilities

### New Capabilities

- 無（本 change 僅修改既有能力與設定格式）。

### Modified Capabilities

- **mcp-server**：**execute** tool 接受 `flowId` 並依 config 解析為檔案或 OpenAPI flow；**discover** tool 可依 config.flowsDir 作為預設目錄；MCP 可選讀 runflow.config，支援 flowsDir、openapi（前綴 → specPath + hooks）。
- **config-openapi**：設定檔的 `openapi` 改為以「前綴」為 key 的結構，每個前綴對應該 OpenAPI spec 的 `specPath` 與 `hooks`（及可選選項）；新增頂層 `flowsDir` 供 CLI 與 MCP 解析檔案型 flowId 的根目錄。

## Impact

- **apps/mcp-server**：需讀取 config、實作與 CLI 一致的 flowId 解析（或共用解析邏輯）；execute 的 inputSchema 與 handler 改為 flowId；discover 可接受 config 的 flowsDir。
- **openspec/specs/mcp-server**：需求更新為 flowId、config 支援、flowsDir / openapi 語意。
- **openspec/specs/config-openapi**：需求更新為 openapi 前綴結構與 flowsDir；若 CLI 已實作此格式，則為對齊 spec 與實作。
- **依賴**：MCP 若共用 flowId 解析，可能需依賴或抽共用模組（與 CLI 共用 config 型別與 resolveFlowId）；或 MCP 自行實作相同語意。
