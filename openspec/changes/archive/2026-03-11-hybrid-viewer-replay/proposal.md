## Problem

在 CLI `dev` 模式下，由於 WebSocket 廣播 (FLOW_RELOAD) 與前端連線之間存在競爭條件 (Race Condition)，且前端在偵測到 `ws` 參數時會跳過初始的 API 抓取，導致 Viewer 開啟時經常無法顯示 Flow 圖表。此外，CLI dev server 與 `pnpm dev` 啟動的 server 在功能實作上不一致。

## Root Cause

1.  **前端邏輯缺陷**：`useFlowGraph.ts` 在 URL 包含 `ws` 時會跳過 `/api/workspace/graph` 的 fetch，完全依賴 WebSocket 訊息。
2.  **廣播時機過早**：CLI 在啟動 viewer 並發送初始廣播後，瀏覽器尚未完成載入與連線。
3.  **實作分散**：監控檔案 (Watch)、重載 Flow 與 WebSocket 觸發執行的邏輯目前分散在 `apps/cli` 中，未被 `@runflow/viewer` 核心收斂。

## Proposed Solution

採用 **「Hybrid + 連線即推播 (Replay)」** 策略：
1.  **前端修復**：修改 `useFlowGraph.ts`，不論是否有 `ws` 都進行初始 API 抓取，確保 UI 立即顯示 Flow。
2.  **Server 重播機制**：在 `@runflow/viewer` 的 `startViewerServer` 中加入 `onConnection` 處理，當新連線建立時，主動推播當前 Flow 的最新狀態。
3.  **邏輯整合**：將 CLI `dev` 的開發週期管理邏輯（Watch + Reload + Run）整合進 `@runflow/viewer` 的 server library，實現功能對等。

## Success Criteria

1.  執行 `flow dev <file> --open` 後，Viewer 能 100% 穩定顯示 Flow 圖表，不再出現空白現象。
2.  Viewer 在連線成功後能立即獲得當前的執行狀態或圖表結構（Replay）。
3.  CLI dev 模式下的 Workspace API (側邊欄樹狀圖) 功能正常。

## Impact

- Affected code:
    - `packages/viewer/src/hooks/use-flow-graph.ts` (前端抓取邏輯)
    - `packages/viewer/server/lib/index.ts` (Server 啟動與連線處理)
    - `apps/cli/src/dev.ts` (移出開發週期邏輯)
    - `packages/viewer/server/workspace-api.ts` (API 穩定性)
