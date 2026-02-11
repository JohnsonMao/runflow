# Tasks: Implement MCP Server

實作順序建議：先 scaffold app 與 MCP stdio server，再實作 run_flow tool，最後文件與整合驗證。

---

## Phase 1: Scaffold apps/mcp-server

- [x] **1.1** 在 `apps/` 下新增 `mcp-server` 目錄，建立 `package.json`（name 如 `@runflow/mcp-server` 或 `runflow-mcp-server`；dependencies: `@runflow/core`、`@runflow/handlers`、`@modelcontextprotocol/sdk`）、`tsconfig.json`（與 apps/cli 風格一致）、build 設定（tsup 或 vite，產出單一 entry）。
- [x] **1.2** 將 `apps/mcp-server` 納入 pnpm workspace（pnpm-workspace.yaml 已含 apps/* 則無需改）、在 root `turbo.json` 的 pipeline 中為 mcp-server 加入 build（若適用）。
- [x] **1.3** 建立 `apps/mcp-server/src/index.ts`：啟動 MCP server over stdio（使用 @modelcontextprotocol/sdk 的 stdio transport），完成 initialize/list tools 的骨架；尚未實作 run_flow 邏輯時可先回傳空 tool 或 stub。執行 `pnpm --filter @runflow/mcp-server build`（或對應指令）確認可建置。

---

## Phase 2: Implement run_flow tool

- [x] **2.1** 在 MCP server 註冊 tool `run_flow`（或 `runFlow`）：name、description、parameters（flowPath: string 必填，params: object 可選）。
- [x] **2.2** 實作 tool handler：解析 flowPath（相對路徑以 process.cwd() 解析）、呼叫 `loadFromFile` from @runflow/core、`createBuiltinRegistry()` from @runflow/handlers、`run(flow, { registry, params })`；將 RunResult 轉成 MCP tool result content（成功時摘要或 final context，失敗時 error 訊息與必要時 step id）。
- [x] **2.3** 處理錯誤情境：檔案不存在、YAML 無效、執行期錯誤；皆回傳為 tool error 或 result content，含可辨識的錯誤訊息。
- [x] **2.4** 手動或簡單腳本驗證：啟動 server、透過 stdio 送 MCP request 呼叫 run_flow（指向 examples 下既有 flow），確認回傳結果正確。

---

## Phase 3: 文件與收尾

- [x] **3.1** 撰寫 `apps/mcp-server/README.md`：說明如何安裝、啟動（例如 `pnpm --filter @runflow/mcp-server start` 或 npx）、以及 Cursor MCP 設定範例（command + args 指向該 entry）。
- [x] **3.2** 視需要更新 root README：新增「MCP」一節，連結至 apps/mcp-server 的說明。
- [x] **3.3** 執行 `pnpm run check`（或 typecheck + lint + test）確認全 repo 通過；若 mcp-server 有單測可一併加入。

---

## 完成條件

- apps/mcp-server 存在，可建置並以 stdio 啟動 MCP server。
- run_flow tool 可被呼叫、能執行指定 flow 檔案並回傳成功/失敗結果。
- 文件說明如何啟動與設定 Cursor（或他端）MCP 客戶端。
