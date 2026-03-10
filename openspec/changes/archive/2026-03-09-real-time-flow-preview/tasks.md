## 1. 核心引擎擴充 (Execution Engine Hooks)

- [x] 1.1 在 `packages/core/executor.ts` 中實作 `Execution Engine SHALL support runtime life-cycle hooks`，新增事件訂閱機制。
- [x] 1.2 確保 `Execution Engine SHALL NOT block flow completion due to hook execution`，使用非阻塞方式 呼叫 Hook。
- [x] 1.3 為 Executor 新增測試案例，驗證「在 Executor 中引入 Event-driven Hooks」的功能正確性。

## 2. CLI 開發模式實作 (CLI Dev Mode)

- [x] 2.1 在 `apps/cli` 新增 `dev` 指令，實作 `CLI SHALL provide a dev command for hot reload`。
- [x] 2.2 整合 `chokidar` 以「使用 Chokidar 進行檔案監聽」，並在變更時重新解析 DSL。
- [x] 2.3 實作 `CLI SHALL embed a WebSocket server for status push`，並依據「整合 ws 建立輕量化 WebSocket Server」方案啟動伺服器。
- [x] 2.4 定義並實作「WebSocket 通訊協議定義」，包含 `FLOW_RELOAD` 與 `STEP_STATE_CHANGE` 訊息格式。
- [x] 2.5 支援 `--open` 參數，自動開啟瀏覽器並傳遞連線資訊。

## 3. 預覽器動態同步 (Viewer Live Update)

- [x] 3.1 確保 `Viewer SHALL be read-only`，在連線模式下僅反映狀態而不啟動執行。
- [x] 3.2 實作 `Viewer SHALL support WebSocket connection for live updates`，建立 WS 用戶端連線邏輯。
- [x] 3.3 處理 `FLOW_RELOAD` 訊息，動態更新 React Flow 圖表結構。
- [x] 3.4 處理 `STEP_STATE_CHANGE` 訊息，即時更新節點顏色與狀態標籤。

## 4. 整合與驗證

- [x] 4.1 進行端到端測試，確保 CLI 修改檔案後 Viewer 能自動熱重載。
- [x] 4.2 驗證執行流程時，狀態能正確從 Core -> CLI (WS) -> Viewer 同步呈現。
