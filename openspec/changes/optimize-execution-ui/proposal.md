## Why

目前的執行畫面缺乏足夠的視覺回饋，使用者難以直觀地看出執行進度。此外，執行參數設定與執行結果（Log）目前的互動方式（彈窗）會阻斷使用者的視覺連續性，無法在查看畫布變化的同時觀察詳細的執行數據。

## What Changes

- **視覺化點亮 (Visual Highlighting)**：
    - 實作執行路徑的動態點亮（Edge Highlighting）。
    - 增強執行中（Running）與完成（Success/Failure）節點的發光與動畫效果。
- **佈局重構 (Layout Refactoring)**：
    - 將目前的右側彈出式 Sheet 改為固定寬度的側邊欄（Execution Panel）。
    - 側邊欄開啟時，主畫布應自動縮放大小以適應剩餘空間。
- **即時日誌系統 (Real-time Log System)**：
    - 在側邊欄新增 Log 分頁，即時顯示每個步驟的執行狀態與輸出內容（outputs）。
    - 執行開始時自動開啟側邊欄並切換至 Log 分頁。
    - 移除執行完成後的結果彈窗。

## Capabilities

### New Capabilities

- `execution-log-panel`: 提供一個即時更新的執行日誌面板，整合於側邊欄中。
- `flow-execution-visuals`: 增強畫布上的執行視覺效果，包含節點發光與路徑動畫。

### Modified Capabilities

- `web-flow-visualization`: 更新佈局邏輯，支援與側邊欄並存的畫布縮放，並強化狀態渲染。

## Impact

- **Affected code**:
    - `packages/viewer/src/App.tsx`: 佈局重構與 Log 狀態管理。
    - `packages/viewer/src/components/FlowCanvas.tsx`: 視覺效果增強與節點渲染。
    - `packages/viewer/src/components/ExecutionPanel.tsx`: (新組件) 取代 ParamsSheet。
    - `packages/viewer/src/flowGraphToReactFlow.ts`: 增加連線樣式的動態計算。
- **Dependencies**: 無新增。
