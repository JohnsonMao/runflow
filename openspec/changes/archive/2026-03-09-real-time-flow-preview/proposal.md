## Why

當使用者在 headless (非互動式) CLI 環境中開發 `flow.yaml` 時，無法獲得即時的反饋。目前必須手動執行 `flow view` 或重複執行 `flow run` 來檢查修改後的結構與行為。本提案旨在建立「熱重載 (Hot Reload)」與「狀態同步」機制，大幅提升開發體驗。

## What Changes

- **CLI `dev` 指令**: 在 `apps/cli` 新增 `runflow dev <path>` 指令。
- **內嵌 WebSocket Server**: CLI 啟動後將開啟一個 WebSocket 服務，負責廣播檔案變更與執行進度。
- **檔案監聽 (Hot Reload)**: 自動監聽 `flow.yaml` 變更，並在變更後自動重新解析並推送最新的 DSL 給預覽器。
- **執行引擎狀態鉤子**: 在 `packages/core` 的執行引擎中加入生命週期 Hook，以便將執行狀態（Running, Success, Fail）同步至 WS。
- **Viewer 即時同步**: `flow-viewer` 支援透過 WebSocket 連線，動態更新圖表結構與節點狀態。

## Capabilities

### New Capabilities

- `cli-dev-mode`: 新增 `dev` 指令與內嵌 WebSocket Server，提供熱重載 DSL 與即時狀態推播功能。
- `execution-engine-hooks`: 在執行引擎中加入生命週期鉤子 (Runtime Hooks)，供外部追蹤 Step 的進度與狀態變遷。

### Modified Capabilities

- `web-flow-visualization`: 讓 Web Viewer 支援連線至 WebSocket Server，實現圖表結構的自動更新與節點執行狀態的動態呈現。

## Impact

- **Affected code**: `apps/cli`, `apps/flow-viewer`, `packages/core` (executor)。
- **Dependencies**: 引入 `chokidar` (檔案監聽) 與 `ws` (WebSocket) 相關套件。
- **APIs**: 定義一套基於 JSON 的 WebSocket 通訊協議。
