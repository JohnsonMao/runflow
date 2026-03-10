## Why

目前 `flow-viewer` 是一個獨立的 App，其 Server 邏輯與 CLI 的 `dev` 模式邏輯重複且不一致，導致 ID 解析錯誤與 API 404 等問題。本重構旨在將 Viewer 的核心邏輯轉化為一個 Package，讓 CLI 能夠直接導入並啟動對應的伺服器，達成「單一事實來源 (Single Source of Truth)」。

## What Changes

- **遷移目錄結構**: 將 `apps/flow-viewer` 移動至 `packages/viewer`。
- **封裝 Viewer Server**: 在 `packages/viewer` 中實作一個伺服器工廠函數（例如 `startViewerServer`），整合靜態資源託管與 API 路由。
- **整合 CLI 調用**: 修改 `apps/cli`，使其直接依賴 `@runflow/viewer` 並調用其伺服器啟動邏輯，取代目前的笨靜態伺服器實作。
- **統一解析邏輯**: 確保 Viewer Server 使用與 CLI 相同的 `@runflow/workspace` 邏輯來解析 Flow ID。

## Capabilities

### New Capabilities

- `viewer-library-integration`: 提供以函式庫形式啟動 Viewer 伺服器的能力，支援直接傳入配置對象。

### Modified Capabilities

- `cli-dev-mode`: 調整 `dev` 指令實作，改為調用 `@runflow/viewer` 的啟動器。
- `web-flow-visualization`: 調整 Viewer 的初始化邏輯，以適應被嵌入啟動的場景。

## Impact

- **Affected code**: `apps/cli`, `apps/flow-viewer` (搬遷), `packages/workspace` (被統一引用)。
- **Dependencies**: `apps/cli` 新增對 `@runflow/viewer` 的依賴。
- **Build Process**: 更新 `pnpm-workspace.yaml` 與 `turbo.json` 的路徑配置。
