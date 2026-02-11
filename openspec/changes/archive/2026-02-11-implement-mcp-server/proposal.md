# Proposal: Implement MCP Server

## Why

- **MCP 整合**：讓 Cursor、其他 MCP 客戶端能直接呼叫 Runflow 執行 flow，不需透過 CLI；與既有 CLI 並存，同一套 core 多種入口。
- **專案脈絡**：config 已註明 "Future: MCP Server and GUI will reuse @runflow/core"；CLI 已完成，下一步即 MCP Server。

## What Changes

- **新增 MCP Server**：新 app 或 package（如 `apps/mcp-server` 或 `@runflow/mcp-server`），實作 Model Context Protocol server，依賴 `@runflow/core`（與 `@runflow/handlers`）執行 flow。
- **暴露能力**：透過 MCP tools 提供至少「執行指定 flow 檔案」的能力；可選列出 flow、傳入 params 等，以 spec 為準。

## Capabilities

### New Capabilities

- **mcp-server**：MCP server 的邊界、與 core/handlers 的依賴、對外暴露的 tools（如 run flow）、啟動方式（stdio/SSE）、錯誤與輸出格式。

### Modified Capabilities

- 無（CLI 與 core 維持不變；MCP server 為新增消費者，依既有 registry 註冊 handler 模式使用 core。）

## Impact

- **無 Breaking**：不修改既有 `@runflow/core`、`@runflow/cli`、`@runflow/handlers` 的公開 API。
- **依賴**：MCP server 依賴 core（與 handlers），與 CLI 同為 core 的消費者。
- **文件與範例**：README 或 docs 需說明如何啟動與設定 MCP server（例如 Cursor 的 MCP 設定）。

## Non-goals

- 不在此 change 實作 GUI 或其它非 MCP 入口。
- 不擴充 MCP resources 或進階 MCP 功能（可後續 change）；本 change 以「能跑 flow」的 tools 為主。
