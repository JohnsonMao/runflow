## Context

`@packages/viewer` 目前將 API 路由、流程執行、廣播邏輯及 WebSocket 處理高度耦合在少數幾個文件中（如 `workspace-api.ts`, `execution.ts`, `App.tsx`）。這導致代碼難義測試且擴展困難，特別是在 API 路由邏輯與核心執行邏輯交織在一起的情況下。

## Goals / Non-Goals

**Goals:**

- 實現 API Handler 的模組化拆分，將路由邏輯與中間件邏輯分離。
- 解耦流程執行中的廣播邏輯，使其易於在單元測試中被 Mock。
- 提升前端通訊層（WebSocket）的類型安全性與重連穩定性。
- 建立核心後端邏輯與前端 Hook 的單元測試基礎。

**Non-Goals:**

- 不改變目前的 UI 佈局、組件樣式或視覺設計。
- 不引入新的大型框架或外部依賴（Vitest 除外）。
- 不修改 `@runflow/core` 的執行引擎核心代碼。

## Decisions

### 1. 模組化拆分 Workspace API Handler
Rationale: 現有的 `createWorkspaceApiMiddleware` 函數體過長，包含了所有 `/api/workspace/*` 的業務邏輯。將各個 endpoint 提取為獨立的 Handler 函數可以提升可讀性，並允許對單個 API 行為進行單元測試。

### 2. 重構 Execution 與廣播邏輯
Rationale: `reloadAndExecuteFlow` 目前承擔了從磁碟載入 Flow、轉換為圖表數據、發送 UI 重載廣播、執行流程以及發送步驟更新廣播等多重職責。我們將通過定義明確的 `BroadcastFunction` 類型並將廣播行為抽離，使執行邏輯更專注於流程控制。

### 3. 強化 WebSocket 通訊協議與 Hook
Rationale: 現有的 WebSocket 消息使用 `unknown` 類型，且重連機制較為簡單。我們將定義判別聯集（Discriminated Unions）類型的 `WebSocketMessage`，並在 `useWebSocket` 中實現帶有指數退避（Exponential Backoff）的重連策略，以應對網絡波動或開發過程中的伺服器重啟。

### 4. 建立層次化的測試體系
Rationale: 為了確保重構不引入回歸（Regression），我們將在各層次補齊測試：
- **API 層**: 測試 `workspace-api.ts` 的各個 Handler 能針對輸入返回正確的 JSON。
- **執行層**: 測試 `execution.ts` 在執行 Flow 時，能按順序發送正確的廣播消息。
- **前端 Hook 層**: 測試 `useWebSocket` 能正確處理連接、斷開及重連邏輯。

## Risks / Trade-offs

- **[Risk] API 變更導致不相容** → **[Mitigation]** 確保 `apps/cli/src/dev.ts` 同步更新，並在集成測試中驗證其調用鏈。
- **[Risk] WebSocket 消息結構變動導致前端錯誤** → **[Mitigation]** 利用 TypeScript 的共享類型定義，強制要求前端處理所有定義的消息類型，並增加日誌監控。
