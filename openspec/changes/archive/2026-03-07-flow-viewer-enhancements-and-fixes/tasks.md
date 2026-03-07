## 1. Core & Workspace 基礎改動

- [x] 1.1 修改 `packages/core/src/types.ts` 以支援 `Custom Flow ID definition` 與 `Flow tags definition` 並完成 `修改 FlowDefinition 型別與後端掃描`
- [x] 1.2 在 `packages/workspace/src/discover.ts` 中更新 `Workspace SHALL provide discover catalog and entry lookup` 以支援 `Global Flow ID uniqueness` 並完成 `修改 FlowDefinition 型別與後端掃描`
- [x] 1.3 實作 `Workspace SHALL provide tree structure for navigation` 以支援目錄與標籤虛擬樹建構

## 2. Flow-Viewer Bug 修復

- [x] 2.1 修正 `App.tsx` 中的選取狀態，確保 `Flow review SHALL show flow graph when a flow is selected` 並完成 `修復 flow-viewer 導航與自動展開`
- [x] 2.2 在 `FlowSidebar.tsx` 中確保 `ID priority in navigation` 正確運作並完成 `修復 flow-viewer 導航與自動展開`
- [x] 2.3 修改 `use-flow-graph.ts` 以確保 `Flow review SHALL allow the user to supply params and trigger execution` 並完成 `修復參數持久化 Race Condition`

## 3. Flow-Viewer 新功能實作

- [x] 3.1 在 `FlowSidebar.tsx` 實作 `Sidebar Navigation Modes` 與 `Tag View tab switching` 並完成 `側邊欄 Tag View 實作`
- [x] 3.2 實作 `Sidebar Tag View` 模式與 `Tag grouping in sidebar` 並完成 `側邊欄 Tag View 實作`

## 4. 各介面與校驗機制

- [x] 4.1 實作 `Duplicate custom ID detection`，確保 `flow-viewer` 啟動時顯示錯誤訊息
- [x] 4.2 確保 `mcp-server` 在發現重複 ID 時紀錄日誌並繼續運作
- [x] 4.3 在 `apps/cli` 中新增 `cli validate 指令` 以進行 `Global Flow ID uniqueness` 驗證
