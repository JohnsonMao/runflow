## 1. 模組化拆分 Workspace API Handler

- [x] 1.1 建立 `/api/workspace/status` 的獨立 Handler 函數，實現 **Workspace Status Retrieval**。
- [x] 1.2 建立 `/api/workspace/tree` 的獨立 Handler 函數，實現 **Workspace Flow Tree Retrieval**。
- [x] 1.3 拆分 `/api/workspace/graph`, `/api/workspace/detail` 及 `/api/workspace/run` 的路由邏輯。
- [x] 1.4 更新 `createWorkspaceApiMiddleware` 以整合上述模組化拆分的 Handler。

## 2. 重構 Execution 與廣播邏輯

- [x] 2.1 在 `packages/viewer/server/` 中集中定義 `BroadcastFunction` 類型，優化 **重構 Execution 與廣播邏輯**。
- [x] 2.2 重構 `reloadAndExecuteFlow` 函數，解耦載入與執行流程，落實 **Flow Execution and Broadcast**。
- [x] 2.3 更新 `apps/cli/src/dev.ts` 以確保其開發模式調用與重構後的執行邏輯相容。

## 3. 強化 WebSocket 通訊協議與 Hook

- [x] 3.1 定義 `WebSocketMessage` 判別聯集類型，落實 **強化 WebSocket 通訊協議與 Hook**。
- [x] 3.2 在 `packages/viewer/server/state.ts` 中應用類型安全的廣播機制。
- [x] 3.3 在 `useWebSocket` hook 中實現具備指數退避機制的重連邏輯。
- [x] 3.4 優化 `App.tsx` 中的消息處理分支，使用類型 safe 的消息載荷。

## 4. 建立層次化的測試體系

- [x] 4.1 撰寫 `workspace-api.test.ts` 單元測試，驗證 **建立層次化的測試體系**。
- [x] 4.2 撰寫 `execution.test.ts` 測試，模擬 Flow 執行並驗證廣播消息序列。
- [x] 4.3 撰寫 `use-websocket.test.ts` 測試，驗證前端連接與重連邏輯。
