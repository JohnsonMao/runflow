# Proposal: flow-viewer flowDir 與流程圖檢視

## Why

flow-viewer 目前無法像 CLI、MCP 一樣指定工作區（flowDir/config）連接本機 flow 目錄，使用者只能在瀏覽器內手動上傳或貼上資料才能看圖；且 UI 尚未統一採用元件庫，不利維護與一致體驗。讓 flow-viewer 具備「設定 flowDir、列出 flows、選 flow 並檢視流程圖」的能力，並以 shadcn 建構 UI，可與 CLI/MCP 形成同一套工作區語意，並提升可維護性。

## What Changes

- flow-viewer 可設定工作區（flowDir 或透過 runflow.config 的 flowsDir），使圖的資料來源與 CLI/MCP 對齊。
- flow-viewer 提供 flow 列表（discover）與選擇單一 flow 後檢視其流程圖；流程圖渲染沿用既有 flow-graph-format / web-flow-visualization 語意。
- flow-viewer 的 UI 以 shadcn 為準，不自行實作按鈕、表單、側欄等基礎元件。
- 實作方式（例如：後端 API 讀取本機目錄、或 File System Access API 等）在 design 階段決定。

## Capabilities

### New Capabilities

- `flow-viewer-workspace`: flow-viewer 應用層能力：設定 flowDir/工作區、解析 config、列出 flows（discover）、選擇 flow 並取得其 graph 以檢視流程圖；與 workspace 語意一致，UI 使用 shadcn。

### Modified Capabilities

- （無。web-flow-visualization 僅規定圖的輸入格式與渲染行為，資料「從哪來」屬實作細節，由 flow-viewer-workspace 與 design 涵蓋。）

## Impact

- **apps/flow-viewer**：新增或調整設定 flowDir/工作區的入口、flow 列表與選擇流程、呼叫取得 graph 的 API 或邏輯；引入 shadcn，替換自幹 UI 元件。
- **packages/workspace**：若採用後端代理本機目錄，後端會依賴 workspace 的 config、discover、resolveFlow、flowGraph 等；若採瀏覽器端（如 FSA），則可能僅需與既有 CLI 產出的 graph.json 或 FlowDefinition 格式對接。
- **依賴**：flow-viewer 將新增 shadcn（及所需 React/Tailwind 設定）；若新增後端服務則會增加對 @runflow/workspace（與必要時 core）的依賴。
