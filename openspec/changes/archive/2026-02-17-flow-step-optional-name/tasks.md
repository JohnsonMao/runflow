## 1. Core – FlowStep 型別與圖格式

- [x] 1.1 在 packages/core 的 FlowStep 型別與註解中新增 `name?: string`、`description?: string`（標明 display/documentation only）
- [x] 1.2 在 packages/core 的 FlowGraphNode 型別中新增 `description?: string`
- [x] 1.3 在 flowDefinitionToGraph 中：node.label 使用 step.name 存在時為 step.name，否則維持既有 fallback（id 或 "id (type)"）；若 step.description 存在則設定 node.description
- [x] 1.4 確認 loader/parser 保留 step 的 name、description（若有欄位白名單則加入此二欄位）

## 2. flow-viewer

- [x] 2.1 節點標題顯示 name ?? id（或既有 label）；若有 node.description 則在 tooltip 或詳情中顯示

## 3. CLI（可選）

- [x] 3.1 flow detail 輸出中，若有 step.name / step.description 則一併列出

## 4. MCP / discover（可選）

- [x] 4.1 discover_flow_detail 回傳的 step 資訊中，包含 name、description 欄位（若有）

## 5. 驗證與文件

- [x] 5.1 為 step-display-metadata 或 flow-graph label/description 行為補上單元測試（core 或 workspace）
- [x] 5.2 更新 step-display-metadata 與 flow-graph-format 主 spec（archive 時或 sync 時將 delta 併入 openspec/specs/）
