## Why

當前的 `flow-viewer` 在處理 OpenAPI 轉換的 Flow 時，側邊欄無法正確自動展開並標記選取狀態；同時，URL 中的參數在頁面重新整理時會因為競態條件（Race Condition）而被重置。此外，為了提升大型專案中 Flow 的管理效率，需要引入自定義 ID 與標籤（Tags）功能。

## What Changes

- **修正側邊欄選取 Bug**：優化 `App.tsx` 的初始化邏輯，使其能正確解析帶有 `:` 的 OpenAPI `flowId` 並自動展開對應資料夾。
- **修正參數持久化 Bug**：調整 `useFlowGraph` 與 `App.tsx` 的同步機制，防止在載入期間抹除 URL 參數。
- **新增自定義 ID 支援**：允許在 Flow 定義中設定 `id`。若設定，則該 `id` 將作為全域唯一的識別碼，優先於檔案路徑。
- **新增標籤（Tags）功能**：支援在 Flow 中設定多個標籤。
- **側邊欄視圖切換**：在 `flow-viewer` 側邊欄增加「資料夾」與「標籤」分頁，支援按標籤進行虛擬分群。
- **加強校驗機制**：新增重複 ID 的偵測。`flow-viewer` 啟動時若發現重複 ID 將顯示錯誤；MCP 則記錄錯誤日誌；CLI 提供 `validate` 指令進行驗證。

## Capabilities

### New Capabilities

- `custom-flow-id`: 規範自定義 ID 的定義、優先級、全域唯一性校驗以及在不同介面（CLI/MCP/Viewer）的錯誤處理行為。
- `flow-tags-navigation`: 定義 Flow 標籤的語法，以及側邊欄「標籤視圖」的虛擬分群與導航邏輯。

### Modified Capabilities

- `flow-review-ui`: 更新 UI 規範以支援側邊欄的分頁切換模式，並修正參數與選取狀態的同步要求。
- `workspace`: 更新工作區掃描邏輯，以支援 `id` 優先級與標籤索引的建立。

## Impact

- 影響 `packages/core` 中的 `FlowDefinition` 型別。
- 影響 `packages/workspace` 中的 `buildDiscoverCatalog` 與 `buildTreeFromCatalog` 邏輯。
- 影響 `apps/flow-viewer` 的 `App.tsx`、`FlowSidebar.tsx` 與相關 Hooks。
- 影響 `apps/cli` 的指令集（新增 `validate`）。
- 影響 `apps/mcp-server` 的啟動日誌邏輯。
