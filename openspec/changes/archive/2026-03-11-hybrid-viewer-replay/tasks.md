## 1. 前端 Hybrid 載入策略與修復

- [x] 1.1 修改 `packages/viewer/src/hooks/use-flow-graph.ts`，確保不論是否有 WS 參數，都會執行 API fetch 以符合 "Viewer SHALL fetch initial state regardless of WS presence" 要求。
- [x] 1.2 調整 `App.tsx` 中的狀態更新邏輯，確保 API 數據與 WS 數據能正確合併，實作 "Initial load with WS parameter" 場景。

## 2. Server-side Replay 與 WebSocket 增強

- [x] 2.1 針對 "CLI SHALL embed a WebSocket server for status push" 要求，在 `packages/viewer/server/lib/index.ts` 中實作 "Server-side Connection Hook 與 Replay" 決策，紀錄最後一次發送的 `FLOW_RELOAD` 訊息。
- [x] 2.2 在 WebSocket `connection` 事件中，實作 "Replay state on new connection" 需求，主動發送最新的圖表與狀態給新用戶。
- [x] 2.3 確保 `startViewerServer` 輸出的 `broadcast` 函數能與 `onConnection` 勾子正確協作，實作 "CLI SHALL provide a dev command for hot reload" 修正後的重播要求。

## 3. 將 Watcher 邏輯收斂至 Viewer Server (可選但建議)

- [x] 3.1 評估並實作將 `chokidar` 檔案監控邏輯整合至 `startViewerServer` 中，以達成 "將 Watcher 邏輯收斂至 Viewer Server (可選但建議)" 的設計。
- [x] 3.2 簡化 `apps/cli/src/dev.ts` 的 watcher 管理，改為使用 Viewer Server 內置的監控功能。

## 4. CLI 驗證與整合

- [x] 4.1 驗證 `flow dev` 在 `--open` 模式下是否能穩定顯示圖表，測試 "Support --open flag" 場景。
- [x] 4.2 測試在多個瀏覽器分頁同時開啟 `flow dev` 時，所有分頁是否都能正確獲得 Replay 數據。
