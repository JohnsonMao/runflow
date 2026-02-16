# Design: Flow 可視化

## Context

- Runflow 的 flow 為 DAG：`FlowDefinition.steps` 中具 `dependsOn` 的 step 組成執行圖，`packages/core` 已有 `buildDAG`、`topologicalSort`、`validateDAG`。
- CLI 現有 `run`、`list`、`detail`，使用 workspace 的 `resolveAndLoadFlow`、`buildDiscoverCatalog` 等；無圖形輸出。
- 需要三種產出：Mermaid 字串（可貼文件）、graph.json（結構化資料）、Web 互動圖（React Flow）。

## Goals / Non-Goals

**Goals:**

- CLI 可對任意已 resolve 的 flow 輸出 Mermaid 或 graph.json，行為與 list/detail 一致（config/cwd/resolve 規則）。
- 圖的資料格式單一、可共用，供 CLI 與 Web 一致使用。
- Web 可視化可讀取 graph.json 或 FlowDefinition，以 React Flow 渲染 DAG，節點標示 id/type、邊表示 dependsOn。

**Non-Goals:**

- 不實作 flow 編輯或執行於 Web；不變更 executor 或 DAG 語意。
- 不強制 MCP 提供圖形 API（可選後續擴充）。

## Decisions

### 1. 圖資料來源與共用層

- **決策**：由 `FlowDefinition` 建出「圖結構」的邏輯放在 **packages/core** 或 **packages/workspace**，產出符合 flow-graph-format 的結構（nodes + edges）。CLI view 與 Web 皆消費此結構。
- **理由**：buildDAG 已在 core，圖節點需 step id/type 等，放在 core 或 workspace 可避免 CLI/Web 重複解析；格式由 spec 定義，實作集中一處。
- **替代**：只在 CLI 內建圖邏輯、Web 自己從 FlowDefinition 建圖 → 重複且易不一致。

### 2. CLI 子指令與選項

- **決策**：新增 `flow view <flowId>`，支援 `--output mermaid`（預設）與 `--output json`（即 graph.json）。`--config` 與 run/list/detail 一致。
- **理由**：view 為唯讀、不執行 flow，與 run 分離；輸出格式明確、易腳本化。
- **替代**：`flow detail --mermaid` → detail 已有多種輸出（markdown/json），再加圖格式會混雜；獨立 view 較清晰。

### 3. graph.json 格式

- **決策**：採用 flow-graph-format spec 定義的 JSON：`nodes: [{ id, type?, label? }]`、`edges: [{ source, target }]`，可選 `flowName`、`flowDescription`。邊方向為「依賴 → 被依賴」（source 依賴 target 即 target → source），與 Mermaid 一致。
- **理由**：與 React Flow 等庫的節點/邊模型相容；精簡即可，進階欄位可後續擴充。

### 4. Mermaid 語法

- **決策**：使用 `flowchart TB`（自上而下），節點用 `id` 或 `id(type)` 標示，邊為 `depA --> stepB`（depA 指向 stepB 表示 stepB dependsOn depA）。
- **理由**：TB 符合 DAG 執行「從 root 往下」的直覺；語法簡單、GitHub/常見編輯器可渲染。

### 5. Web 可視化放置

- **決策**：以 **獨立 app**（例如 `apps/flow-viewer`）實作，Vite + React + React Flow；可接受 URL 參數或上傳 graph.json / flow YAML，僅渲染、不執行。
- **理由**：與 CLI、MCP 解耦；未來若需內嵌至 MCP GUI 可抽共用元件。先不與現有 apps 合併，避免無謂依賴。
- **替代**：內嵌於 MCP server 的靜態頁 → 需 MCP 帶靜態資源與路由，複雜度較高；獨立 app 更單純。

### 6. 依賴

- **決策**：CLI 不新增 npm 依賴（僅用 core/workspace）。Web app 新增 `reactflow`（及 React 生態）。
- **理由**：圖生成為純邏輯；React Flow 為業界常用、文件齊全。

## Risks / Trade-offs

- **[Risk] 大 DAG 在 Web 上效能/可讀性** → 先不實作縮放/分層篩選；若需求出現再加虛擬化或篩選。
- **[Risk] flow view 與 run 的 resolve 行為不一致** → view 一律使用與 run 相同的 `resolveFlowId` + `loadFlowFromResolved`，共用 workspace 邏輯。
- **[Trade-off] 不輸出 DOT** → 僅 Mermaid + JSON；若日後需要 DOT，可再擴一層轉換（Mermaid/JSON 為主要合約）。
