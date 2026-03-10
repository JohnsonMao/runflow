## Why

目前 `runflow dev --open` 預設開啟託管在 `https://runflow.js.org/viewer` 的 Viewer。這在離線環境或受限網路環境下無法運作，且依賴外部服務。本提案旨在讓 CLI 能夠在本地啟動靜態伺服器來託管 `flow-viewer` 的靜態資源，提供完全本地化、零依賴的開發體驗。

## What Changes

- **CLI 內嵌靜態伺服器**: 在 `apps/cli` 的 `dev` 指令中整合一個輕量級的 HTTP 靜態伺服器（例如使用 `sirv` 或 `polka`），用於託管 `apps/flow-viewer/dist` 目錄下的內容。
- **自動化打包整合**: 確保 CLI 的發行版本（dist）包含 Viewer 的靜態資源，或在開發環境下能正確找到路徑。
- **預設開啟行為調整**: `flow dev --open` 將優先開啟本地啟動的靜態伺服器網址，而非外部網址。
- **支援 Offline 模式**: 使用者可以在完全不連網的情況下，透過本地 Viewer 獲得即時預覽與熱重載功能。

## Capabilities

### New Capabilities

- `cli-static-viewer-hosting`: 提供在 CLI 內部啟動 HTTP 伺服器並託管本地 Viewer 靜態資源的能力。

### Modified Capabilities

- `cli-dev-mode`: 擴展 `dev` 指令的行為，整合靜態伺服器啟動與網址重導向邏輯。

## Impact

- **Affected code**: `apps/cli` (主要在 `dev.ts`), `apps/flow-viewer` (打包流程)。
- **Dependencies**: 引入輕量級 HTTP 伺服器套件（如 `sirv`）。
- **Build Process**: 調整 CLI 的建置腳本，以確保 Viewer 的靜態資源被正確包含或定位。
