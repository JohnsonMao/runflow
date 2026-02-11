# Design: MCP Server

## 1. 邊界與依賴

- **位置**：新 app 於 `apps/mcp-server`（與 `apps/cli` 並列），納入 pnpm workspace 與 Turborepo。
- **依賴**：僅 `@runflow/core`（loadFromFile, run, types）、`@runflow/handlers`（createBuiltinRegistry）。MCP 協定實作使用官方 SDK（如 `@modelcontextprotocol/sdk`）以維持相容性。
- **不依賴**：不依賴 CLI；不修改 core 或 handlers 的公開 API。

## 2. Transport

- **stdio**：首版以 stdio 為主。Server 以子行程啟動，stdin/stdout 用於 MCP JSON-RPC（stdio transport）。與 Cursor 等客戶端預設啟動方式一致。
- **SSE**：可選、後續擴充；本 change 不實作 SSE。

## 3. Tools

- **run_flow**（或 `runFlow`，依 SDK 慣例）：
  - **Arguments**：`flowPath`（必填，string，flow 檔案路徑）、`params`（可選，object，傳入 flow 的初始參數）。
  - **行為**：解析 path（相對路徑以 process.cwd() 或約定工作目錄解析）、loadFromFile、createBuiltinRegistry()、run(flow, { registry, params })；將 RunResult 轉成 MCP tool 回傳格式（success + text/contents 表示結果或錯誤）。
  - **錯誤**：檔案不存在、YAML 無效、執行期錯誤皆回傳為 tool error 或 result content，含簡短錯誤訊息。

## 4. 與 Core / Handlers 的整合

- 與 CLI 相同：每次 run 前 `createBuiltinRegistry()`，不保留跨 request 的 registry 狀態。
- 不讀取 runflow.config（首版）；不支援 config 的 handlers / openapi。若未來要支援，可再開 change（讀 config、merge handlers）。

## 5. 專案結構（建議）

```
apps/mcp-server/
  package.json     # name: @runflow/mcp-server 或 runflow-mcp-server，dep: @runflow/core, @runflow/handlers, @modelcontextprotocol/sdk
  tsconfig.json
  tsup.config.ts   # 或 vite，產出單一 entry 供 node 執行
  src/
    index.ts       # 啟動 MCP server over stdio，註冊 run_flow tool，處理 request
```

- Entry：`node dist/index.js` 或 `node .` 後即開始 listen stdin、寫入 stdout。
- Tool handler 內：呼叫 loadFromFile(path)、run(flow, { registry: createBuiltinRegistry(), params })；將 result 序列化為 MCP 回傳內容。

## 6. 錯誤與輸出格式

- **成功**：tool result 的 content 可為一段 text（例如 "Flow completed. Steps: 3. Last context keys: ..."）或簡短 JSON 摘要（stepCount, success, finalContext 子集），以可讀為優先。
- **失敗**：content 含錯誤訊息；若為 step 失敗，盡量包含 step id 與 error 字串。MCP 層的 error 欄位可一併使用。

## 7. 文件

- **README**（apps/mcp-server）：說明如何安裝、啟動（例如 `pnpm --filter @runflow/mcp-server start` 或 npx）、以及 Cursor MCP 設定範例（command + args 指向該 entry）。
- Root README 可加一節「MCP」指向 apps/mcp-server 的說明。

## 8. 小結

| 項目 | 決策 |
|------|------|
| 位置 | apps/mcp-server |
| Transport | stdio（首版） |
| Tools | run_flow(flowPath, params?) |
| Registry | 每次 run 使用 createBuiltinRegistry()，不讀 config |
| 輸出 | 成功/失敗皆回傳 result content；錯誤含訊息與必要時 step id |
