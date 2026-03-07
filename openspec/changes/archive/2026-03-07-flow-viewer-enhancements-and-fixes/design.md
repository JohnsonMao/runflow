## Context

目前 `flow-viewer` 在大型工作區中面臨兩個問題：一是對 OpenAPI Flow 的導航支援不佳，二是缺乏除了檔案目錄以外的分類方式。同時，由於前端狀態管理與 URL 同步的競態條件，導致使用者重新整理頁面時參數會消失。

## Goals / Non-Goals

**Goals:**
- 提供全域唯一的 Flow ID 與標籤（Tags）支援。
- 修復 `flow-viewer` 的導航自動展開與參數持久化 Bug。
- 在 `flow-viewer` 側邊欄實作「標籤視圖」分頁。
- 建立全域 ID 唯一性檢查機制。

**Non-Goals:**
- 修改 Flow 的執行引擎邏輯。
- 修改 `formatRunResult` 的核心呈現方式。

## Decisions

### 1. 修改 `FlowDefinition` 型別與後端掃描
在 `packages/core/src/types.ts` 中增加 `id?: string` 與 `tags?: string[]`。
在 `packages/workspace/src/discover.ts` 中修改 `buildDiscoverCatalog`：
- 建立 `idMap: Map<string, string>` 紀錄 `flowId` 到檔案路徑的對應。
- 若 `flow` 有定義 `id`，則 `flowId = id`；否則使用相對路徑。
- 若發現 `id` 衝突，則將錯誤資訊存入 `DiscoverEntry`（新增 `error` 欄位）或在 Loader 中拋出。

### 2. 修復 `flow-viewer` 導航與自動展開
修改 `apps/flow-viewer/src/App.tsx`：
- `openFolderIds` 的初始化邏輯需考慮 `:` (OpenAPI) 與自定義 ID。
- 若 `flowId` 包含 `:`，自動產生 `openapi:{prefix}` 加入 `openFolderIds`。
- 統一資料夾 ID 格式為 `folder:{path}` 或 `openapi:{key}`。

### 3. 修復參數持久化 Race Condition
修改 `apps/flow-viewer/src/hooks/use-flow-graph.ts`：
- 在 `setParamValues({})` 之前，先檢查 URL 參數。
- 引入一個 `initializedRef`，確保只有在 Flow Detail 載入完成並回填 URL 參數後，才允許 `App.tsx` 的同步 Effect 覆蓋 URL。

### 4. 側邊欄 Tag View 實作
修改 `apps/flow-viewer/src/components/FlowSidebar.tsx` 與相關組件：
- 引入 `Tabs` 組件切換 Folder/Tags。
- 實作 `buildTagTree(catalog)` 函數，將 `DiscoverEntry[]` 轉換為按標籤分群的 `TreeNode[]`。
- 標籤節點 ID 格式為 `tag:{name}`。

### 5. CLI Validate 指令
在 `apps/cli/src/cli.ts` 增加 `validate` 指令，調用 `buildDiscoverCatalog` 並檢查回傳的錯誤。

## Risks / Trade-offs

- **[Risk] 使用者自定義 ID 與檔案路徑衝突** → [Mitigation] 在掃描階段進行全域唯一性檢查，若衝突則視為錯誤。
- **[Risk] 一個 Flow 多個標籤導致在 Tag View 出現多次** → [Mitigation] 這是預期行為，方便從不同維度查找。
- **[Trade-off] 效能影響** → [Decision] 掃描 Catalog 時建立標籤索引雖然增加少許開銷，但相對於 Flow 數量來說在可接受範圍內。
