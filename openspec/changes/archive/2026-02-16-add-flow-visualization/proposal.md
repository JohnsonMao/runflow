# Proposal: Flow 可視化

## Why

Flow 目前僅能透過 YAML 與 CLI list/detail 以文字檢視，缺少 DAG 的圖形化呈現，不利除錯、文件與協作。提供 Mermaid／graph 輸出與 Web 可視化可讓開發者與協作者快速理解步驟依賴與執行順序。

## What Changes

- CLI 新增子指令（例如 `view`）：對指定 flow 輸出 **Mermaid** 流程圖文字，方便貼到文件或 Mermaid Live 渲染。
- CLI 支援 **`--output graph.json`**（或等價選項）：輸出圖的結構化資料（nodes/edges），供外部工具或 Web 使用。
- 新增 **Web 可視化**：以 React Flow（或同等圖庫）實作 flow DAG 的互動式圖形介面，資料來源可為 graph.json 或直接載入 flow 定義。

## Capabilities

### New Capabilities

- **cli-flow-view**: CLI 子指令（如 `flow view <flowId>`）可輸出 flow 的圖形表示；支援輸出格式為 Mermaid 或 graph.json（例如 `--output mermaid` / `--output graph.json` 或預設 Mermaid）。
- **flow-graph-format**: 定義 flow 圖的共用資料格式（nodes、edges、可選 metadata），供 CLI 輸出與 Web 可視化一致使用；僅描述格式與語意，不綁定實作。
- **web-flow-visualization**: Web 應用或頁面以 React Flow 渲染 flow DAG，節點顯示 step id/type 等，邊表示 dependsOn；資料可來自 graph.json 或 FlowDefinition。

### Modified Capabilities

- （無：未變更既有 spec 的 requirement。）

## Impact

- **apps/cli**：新增 view 子指令與輸出格式選項；依賴 workspace 的 resolve/load flow。
- **packages/workspace 或 packages/core**：可選地抽出「由 FlowDefinition 建 DAG 圖資料」的共用邏輯，供 CLI 與 Web 共用。
- **新 app 或 package**：若 Web 可視化為獨立 app（例如 Vite + React），會新增對應的 app 與依賴（如 reactflow）；若內嵌於既有 app 則影響該 app。
- **依賴**：Web 端需 React Flow（或替代圖庫）；CLI 僅用既有 core/workspace，無新依賴。
