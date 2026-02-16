# Design: flow-viewer flowDir 與流程圖檢視

## Context

flow-viewer 為 Runflow 的 Web 應用，目前僅能透過手動上傳或貼上 graph.json/FlowDefinition 來渲染流程圖；無工作區（flowDir/config）概念，也無 flow 列表與選擇流程。CLI 與 MCP 已透過 @runflow/workspace 取得 config、buildDiscoverCatalog、resolveFlowId、flowGraph 等；flow-viewer 需與之對齊並以 shadcn 統一 UI。約束：瀏覽器無法直接讀取本機目錄，需透過後端或 File System Access API 取得工作區資料。

## Goals / Non-Goals

**Goals:**

- flow-viewer 能「設定工作區」（flowDir 或 runflow.config 的 flowsDir），語意與 CLI/MCP 一致。
- 提供 flow 列表（discover）與選擇單一 flow，並檢視其流程圖（flow-graph-format → 既有 React Flow 渲染）。
- UI 以 shadcn 為準（側欄、按鈕、表單、列表等），不重複造輪。

**Non-Goals:**

- 不執行 flow、不編輯 flow 定義、不取代 CLI/MCP；僅檢視。
- 不在此設計中實作 OpenAPI 衍生 flow 的列表/解析（可後續擴充）；先以「檔案型 flow + flowsDir」為主。

## Decisions

### 1. 工作區資料來源：開發期後端 API（Vite 或獨立 dev server）

**選擇**：在開發/本機使用情境下，由一層後端提供「工作區根路徑」並代為呼叫 @runflow/workspace，前端透過 REST（或 Vite proxy）取得 list 與 graph。

**理由**：  
- 直接複用 workspace 的 findConfigFile、loadConfig、buildDiscoverCatalog、resolveFlowId、flowGraph，與 CLI/MCP 行為一致。  
- File System Access API 支援度與 UX（每次要選目錄）較不理想；後端 API 一次設定 flowDir 即可。  
- 先以「開發時連接本機目錄」為目標，生產部署（若未來需要）可再考慮靜態 JSON 或別種資料源。

**替代方案**：  
- **FSA**：瀏覽器直接選目錄 → 無法讀取 runflow.config.mjs 等動態模組，且需使用者每次授權。  
- **純靜態**：僅上傳/貼上 → 不滿足「設定 flowDir、列出 flows」的需求。

### 2. 後端形態：Vite plugin 提供 API 或同 monorepo 內小型 Express 服務

**選擇**：以 **Vite 開發伺服器 + 自訂 plugin** 注入 API 路由（例如 `/api/workspace/list`、`/api/workspace/graph?flowId=...`），plugin 內使用 @runflow/workspace；工作區路徑由環境變數或 vite 設定傳入（例如 `FLOW_VIEWER_WORKSPACE_ROOT` 或 `flowViewer.workspaceRoot`）。

**理由**：  
- flow-viewer 已是 Vite app，無需多開一個 process；開發時一鍵 `pnpm dev` 即可。  
- 與現有 monorepo 建置方式一致；必要時可再拆成獨立小服務。

**替代方案**：  
- 獨立 Express 服務：需額外啟動與 CORS/port 管理，開發體驗較重。

### 3. 前端：單頁結構 + shadcn

**選擇**：  
- 版面：可選側欄（flow 列表）+ 主區（流程圖），或頂部「工作區路徑 + flow 選擇」+ 下方圖；具體版面在 tasks 實作時用 shadcn 的 Sidebar、Select、Button 等組成。  
- 設定 flowDir：若後端從環境/設定讀取，前端可顯示「目前工作區」並提供說明（例如「請設定 FLOW_VIEWER_WORKSPACE_ROOT」）；若未來後端支援 POST 更新工作區根，再擴充表單。  
- 列表與選 flow：呼叫後端 list API，以 shadcn 清單/Select 呈現；選擇後呼叫 graph API，將回傳的 flow-graph-format 交給既有 FlowCanvas 渲染。

### 4. 依賴與邊界

- **apps/flow-viewer**：依賴「後端 API 契約」（list 回傳 DiscoverEntry[] 形狀、graph 回傳 flow-graph-format）；不直接依賴 @runflow/workspace（僅後端依賴）。  
- **Vite plugin（或同 app 內 server 模組）**：依賴 @runflow/workspace（findConfigFile、loadConfig、buildDiscoverCatalog、resolveFlowId）、@runflow/core 或 workspace 的 flowGraph；讀取工作區路徑由 Vite config 或 env 提供。  
- **shadcn**：在 flow-viewer 內加入 shadcn 與所需 Tailwind/React 設定，新 UI 一律用 shadcn 元件。

## Risks / Trade-offs

| 風險 | 緩解 |
|------|------|
| 僅開發期可用、生產無法「選本機目錄」 | 先滿足開發/本機檢視；生產若需要可後續加「上傳 JSON」或遠端 API 來源。 |
| 工作區路徑需在後端設定，使用者無法在 UI 自選目錄 | 以 env/設定檔為主；若需 UI 選目錄，可後續讓後端支援「上傳 zip / 指定已掛載路徑」等。 |
| Vite plugin 與 Node 端依賴（workspace）增加 build 複雜度 | plugin 僅在 dev 或明確啟用時載入；prod build 可為純靜態，不包含 workspace。 |

## Migration Plan

- 無既有生產資料；為新功能。  
- 實作順序：在 flow-viewer 加入 shadcn → 實作後端 API（Vite plugin 或 dev server）→ 前端「工作區說明 + 列表 + 選 flow + 顯示圖」→ 移除或替換既有自幹 UI 元件。  
- 若未來改為獨立後端服務，僅需將 API 契約保持不變、前端 base URL 可配置即可。

## Open Questions

- 是否在本次實作中支援「前端輸入工作區路徑」並由後端動態切換（例如 POST /api/workspace/root）？建議第一版以 env/設定為主，減少安全與路徑驗證範圍。  
- OpenAPI 衍生 flow 的 discover/list 是否納入：可依 workspace 的 buildDiscoverCatalog 一併回傳，前端無需區分；僅需後端在 resolveFlowId + flowGraph 時支援 openapi 型 flow（與 CLI 一致）。
