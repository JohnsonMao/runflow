## Context

目前 `@runflow/viewer` 作為一個 Library，提供了啟動伺服器的功能。但在 CLI 的 `dev` 模式下，許多「開發週期」相關的邏輯（如：監控檔案、重新載入 Flow、WebSocket 觸發執行）目前實作在 `apps/cli` 中，這導致了代碼重複以及 Viewer 前後端狀態同步的不可靠性。

## Goals / Non-Goals

**Goals:**
- 修復 Viewer 啟動時的空白畫面 Bug。
- 在 WebSocket 連線建立後立即「重播」最新狀態。
- 統一 CLI 與 Standalone Viewer 的 Server 行為。
- 確保 Workspace API (側邊欄) 在 CLI dev 模式下依然可用。

**Non-Goals:**
- 改變現有的 Flow YAML 語法。
- 實作全新的 WebSocket 協議。

## Decisions

### 1. 前端 Hybrid 載入策略
修改 `packages/viewer/src/hooks/use-flow-graph.ts`，移除對 `ws` 參數存在時跳過 fetch 的判斷。
- **Rationale**: 即使有 WS，API 提供的靜態數據也是 Viewer 能夠快速顯示的第一手來源。這能解決 Race Condition。
- **Alternatives**: 
    - *全 WS 模式*: 複雜度高，需在 WS 層實作 Request/Response。

### 2. Server-side Connection Hook 與 Replay
在 `packages/viewer/server/lib/index.ts` 中，擴展 `onConnection` 勾子的功能。當新的 WebSocket 連線建立時，Server 會檢查是否有當前的 `workspaceCtx` 或最後已知的 Graph 狀態，並立即發送 `FLOW_RELOAD`。
- **Rationale**: 讓晚連入的 Viewer 能立即追上 Server 的狀態，不需等待下一次檔案變動。

### 3. 將 Watcher 邏輯收斂至 Viewer Server (可選但建議)
雖然目前 CLI 使用 `chokidar`，但為了達成功能一致，未來考慮讓 `startViewerServer` 可接受一個 `watchPath` 參數，內部自動處理 Reload。
- **當前步驟**: 先優化連線機制與前端抓取，暫不移動 Watcher 但保留介面擴展性。

## Risks / Trade-offs

- **[Risk]** API 抓取與 WS 重播可能導致短時間內的兩次 UI 更新。
- **[Mitigation]** 前端可根據數據的時間戳或 Hash 判斷是否需要重繪，或簡單地讓後者覆蓋前者（React 的渲染效率足以應付）。
