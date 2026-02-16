# Proposal: FlowStep 支援選用 name 與 description

## Why

流程圖、CLI detail、MCP discover 等需要對每個 step 顯示可讀標籤與說明。目前 step 僅有 `id`（機器用識別），缺少人可讀的「名稱」與「說明」，導致圖上節點或文件只能顯示 id 或 "id (type)"，不利閱讀與文件化。在 FlowStep 層級新增選用欄位 `name` 與 `description`，可讓 YAML 作者為每個步驟填寫顯示名稱與說明，並由各消費者（flow-graph、CLI、MCP、flow-viewer）一致使用。

## What Changes

- **FlowStep 擴充**：在 `packages/core` 的 FlowStep 型別與語意上，新增兩個選用欄位（僅供顯示/文件，不影響執行）：
  - `name?: string`：短標籤，供節點標題、列表、日誌顯示；若未提供，消費者仍以 id（或 "id (type)"）為 fallback。
  - `description?: string`：較長說明，供 tooltip、詳情頁、discover 等；可多行，消費者得選擇支援 Markdown。
- **Flow 圖格式**：圖的節點 `label` 在 step 有 `name` 時應優先使用 `name`；節點可選包含 `description`（來自 step.description）供 tooltip/詳情使用。
- **Parser / Loader**：需允許並保留 step 上的 `name`、`description`（不影響既有驗證）。
- **消費者**：CLI detail、MCP discover_flow_detail、flow-viewer 等可選擇顯示 step.name / step.description。

無 breaking change；既有 YAML 不填 name/description 行為不變。

## Capabilities

### New Capabilities

- `step-display-metadata`：定義 FlowStep 的選用欄位 `name` 與 `description` 的語意與用途（僅顯示/文件，不影響 context、DAG、執行）。涵蓋 YAML 結構與 core 型別。

### Modified Capabilities

- `flow-graph-format`：節點 `label` 在 step 有 `name` 時應使用 step.name，否則 fallback 為 id 或 "id (type)"；節點 MAY 包含 `description`（string，來自 step.description）供 tooltip/詳情。

## Impact

- **packages/core**：`types.ts` 的 FlowStep 註解/型別新增 `name?: string`、`description?: string`；parser/loader 若對 step 做欄位過濾或驗證，需允許此二欄位。
- **packages/workspace** 或 **packages/core**（flowGraph）：產圖時 node.label 使用 step.name ?? id（或既有 "id (type)" 邏輯）；node 可選帶入 step.description。
- **apps/flow-viewer**：節點標題可顯示 name ?? id；tooltip 或詳情可顯示 description。
- **apps/cli**：detail 輸出可列出 step name/description（若有）。
- **MCP / discover**：discover_flow_detail 回傳的 step 資訊可包含 name、description。
- **YAML / 現有 flow**：既有只使用 id 的 flow 不需修改；新欄位為選用，向後相容。
