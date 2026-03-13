## Context

目前 `packages/viewer` 使用 `App.tsx` 作為入口，右側使用 Radix UI 的 `Sheet` (Drawer) 作為 Overlay。畫布（React Flow）佔據剩餘空間，但在 Sheet 開啟時會被部分遮擋。執行狀態僅透過 `stepStatuses` 反映在節點內部，連線樣式（Edges）是靜態生成的。

## Goals / Non-Goals

**Goals:**
- 將佈局重構為 Sidebar 模式，實現畫布寬度自動調整。
- 實作動態 Edge 樣式更新。
- 建立 `ExecutionPanel` 組件，整合參數設定與 Log。
- 移除 `ResultDialog`。

**Non-Goals:**
- 修改後端 WebSocket 傳輸協議（將沿用現有的 `STEP_STATE_CHANGE`）。
- 實作 Log 的持久化存儲。

## Decisions

### Sidebar Layout Refactoring
- **方案**: 在 `App.tsx` 中使用 `flex` 佈局。中間為 `main` (畫布)，右側為 `ExecutionPanel`。
- **原因**: 傳統的 Overlay `Sheet` 會遮擋 UI。使用 `Sidebar` 模式搭配 `flex-1` 可以讓畫布在側邊欄開啟時自動縮小。
- **細節**: 在 `App.tsx` 新增 `executionPanelOpen` 狀態。

### Real-time Log State Management
- **方案**: 在 `App.tsx` 維護一個 `logs` 數組：`Array<{ stepId: string, status: string, outputs?: any, timestamp: number }>`。
- **原因**: 需要將分散的 WebSocket 訊息聚合在一起顯示。

### Dynamic Edge Highlighting
- **方案**: 修改 `FlowCanvas.tsx`，在 `useEffect` 中同步 `stepStatuses` 時，同時重新計算 `edges` 的樣式。
- **樣式**: 如果 Source Node 為 `success` 且 Target Node 為 `running`，將 Edge 設為 `animated: true`, `strokeWidth: 3`, `stroke: #3b82f6` (blue-500)。

### ExecutionPanel Component
- **方案**: 使用 `shadcn/ui` 的 `Tabs` 組件切換 "Params" 與 "Logs"。
- **原因**: 簡潔地整合兩種不同的資訊。

## Risks / Trade-offs

- **[Risk]** 畫布縮放效能問題 → **[Mitigation]** React Flow 的 `fitView` 可能會引起頻繁重繪，應使用 `debounce` 或僅在側邊欄切換完成後呼叫。
- **[Trade-off]** 移除彈窗可能導致執行完成時不夠明顯 → **[Mitigation]** 在 Log 面板底部顯示明顯的「執行完成」標誌。
