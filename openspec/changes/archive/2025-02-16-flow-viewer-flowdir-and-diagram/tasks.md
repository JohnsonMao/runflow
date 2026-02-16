## 1. shadcn 與專案設定

- [x] 1.1 在 apps/flow-viewer 加入 shadcn 與所需 Tailwind/React 設定（init 或手動裝 components.json、依賴）
- [x] 1.2 新增 flow-viewer 所需 shadcn 元件：Sidebar、Button、Select、Card、必要時 Label/Input（依實際版面選用）

## 2. 後端 API（Vite plugin / dev server）

- [x] 2.1 新增 Vite plugin 或 dev 專用 server 模組：讀取工作區根路徑（FLOW_VIEWER_WORKSPACE_ROOT 或 vite config），使用 findConfigFile、loadConfig、buildDiscoverCatalog
- [x] 2.2 實作 GET /api/workspace/list：回傳 DiscoverEntry[] 形狀的 flow 列表
- [x] 2.3 實作 GET /api/workspace/graph?flowId=...：使用 resolveFlowId、loadFlow、flowDefinitionToGraphForVisualization，回傳 flow-graph-format JSON
- [x] 2.4 實作 GET /api/workspace/status 或於 list 回傳中提供「目前工作區路徑」供前端顯示

## 3. 前端：工作區與流程圖

- [x] 3.1 前端顯示「目前工作區」說明（或未設定時顯示如何設定 FLOW_VIEWER_WORKSPACE_ROOT）
- [x] 3.2 呼叫 list API 並以 shadcn 元件顯示 flow 列表（側欄或 Select）
- [x] 3.3 使用者選擇 flow 時呼叫 graph API，將回傳的 flow-graph-format 傳入既有 FlowCanvas 渲染
- [x] 3.4 錯誤處理：list/graph 失敗時顯示可辨識的錯誤訊息（shadcn 或簡單文案）

## 4. UI 一致性

- [x] 4.1 將既有 flow-viewer 中可替換為 shadcn 的按鈕、表單、列表等改為使用 shadcn 元件
- [x] 4.2 確認版面（側欄 + 主區或頂部 + 圖區）符合 flow-viewer-workspace spec 與 design，並通過 pnpm run check
