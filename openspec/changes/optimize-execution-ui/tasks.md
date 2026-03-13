## 1. 佈局重構與基礎狀態管理

- [x] 1.1 在 `App.tsx` 實作 **Sidebar Layout Refactoring**，將畫布區域改為 Flex 佈局。
- [x] 1.2 在 `App.tsx` 新增 `logs` 狀態與 **Real-time Log State Management**，處理 `STEP_STATE_CHANGE` 並聚合 Log 資料。
- [x] 1.3 實作 **Viewer SHALL support dynamic canvas resizing**，確保側邊欄切換時畫布能自動重繪並調用 `fitView`。

## 2. 執行面板 (Execution Panel) 實作

- [x] 2.1 建立 `ExecutionPanel` 組件以實作 **Execution Log Panel SHALL be accessible via a Sidebar**，包含 Params 與 Logs 標籤頁。
- [x] 2.2 實作 **Execution Log Panel SHALL display real-time step updates**，將 `logs` 狀態渲染於 Logs 分頁中。
- [x] 2.3 在 `App.tsx` 中實作 **Scenario: Auto-switch to Logs tab on execution start**，在執行開始時自動打開面板並切換分頁。

## 3. 畫布視覺效果增強 (Visual Enhancements)

- [x] 3.1 在 `FlowCanvas.tsx` 中實作 **Node Visual Highlighting SHALL reflect current execution state**，為節點添加發光與動畫。
- [x] 3.2 實作 **Dynamic Edge Highlighting** 並確保 **Edge Highlighting SHALL reflect active execution path**，根據 `stepStatuses` 動態更新 `edges`。
- [x] 3.3 實作 **Scenario: Animate edges on the execution path**，當連接的節點處於活動狀態時，邊線應顯示流動動畫。

## 4. 清理與驗證

- [x] 4.1 實作 **Scenario: No execution results popup** 以符合 **Viewer SHALL be read-only** 的修改，移除 `ResultDialog` 組件。
- [x] 4.2 驗證所有視覺效果與 Log 更新在 `dev` 模式下能正常運作。
