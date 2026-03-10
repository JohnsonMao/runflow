## Context

目前 Runflow CLI 的 `dev` 模式依賴託管在 `https://runflow.js.org/viewer` 的外部 Viewer 資源。這限制了離線開發的可能性。本設計提出在 CLI 中整合靜態檔案伺服器，直接託管 `apps/flow-viewer` 的建置產物。

## Goals / Non-Goals

**Goals:**
- 在 `flow dev` 啟動時同時開啟靜態伺服器。
- 使 `flow dev --open` 預設開啟本地 Viewer 網址。
- 確保 CLI 能夠在各種環境下定位到 Viewer 的靜態資源。
- 支援完全離線的 Flow 開發與預覽。

**Non-Goals:**
- 不涉及在 Viewer 中編輯 YAML 並存檔的功能。
- 不改變目前的 WebSocket 通訊協議。

## Decisions

### 1. 使用 `sirv` 作為靜態檔案伺服器
選擇 `sirv` 是因為它極其輕量（約 1KB），效能優異，且與 Vite 的預設產物配合良好。
- **Rationale**: CLI 工具應保持輕量，避免引入如 Express 等大型框架。

### 2. 靜態資源的定位機制
在開發環境中，使用 `path.resolve` 指向 `apps/flow-viewer/dist`。在正式發布版本中，透過建置腳本將 Viewer 資源拷貝至 CLI 的 `dist/viewer` 目錄下。
- **Rationale**: 確保無論是開發者執行原始碼還是使用者執行 npm 安裝的二進位檔，都能正確找到資源。

### 3. 動態連接埠分配
靜態伺服器與 WebSocket 伺服器將共享同一個 Port（如果可能）或使用相鄰 Port。
- **Rationale**: 簡化使用者配置，預設行為應盡可能自動化。

## Risks / Trade-offs

- **[Risk]** Viewer 資源過大導致 CLI 安裝包體積增加 → **Mitigation**: 確保 Viewer 進行 Tree-shaking 與壓縮。
- **[Risk]** 建置流程複雜度增加 → **Mitigation**: 透過 Turborepo 的 Task 依賴管理，確保 `flow-viewer` 先於 `cli` 完成建置。
