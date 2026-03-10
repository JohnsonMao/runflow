## Context

目前 `flow-viewer` 位於 `apps/` 目錄下，其內嵌的伺服器邏輯與 CLI 的 `dev` 模式存在大量重複代碼，且 ID 解析邏輯不一致。這導致了子流程解析失敗、參數載入中以及 404 等問題。本設計提出將 Viewer 核心邏輯抽離為 Package，並讓 CLI 成為其 Host。

## Goals / Non-Goals

**Goals:**
- 將 `apps/flow-viewer` 遷移至 `packages/viewer`。
- 使 Viewer 成為一個可導入的模組，由 CLI 負責啟動其伺服器。
- 達成「單一事實來源」：CLI 與 Viewer Server 共享同一個解析與掃描邏輯。
- 解決 `dev` 模式下子流程 ID 解析失敗與參數介面載入的問題。

**Non-Goals:**
- 不改變目前 React Flow 的圖表渲染邏輯。
- 不影響 `flow-viewer` 作為獨立 App 運行的能力。

## Decisions

### 1. 搬遷並重新定義為 `@runflow/viewer`
將程式碼移動到 `packages/viewer`，並在 `package.json` 中將其類型定義為可用於導入的 Library。
- **Rationale**: 讓 CLI 能直接建立編譯時依賴，簡化啟動邏輯。

### 2. 封裝 `startViewerServer` 工廠函數
在 `packages/viewer/server` 導出一個統一的接口，處理 HTTP API、靜態資源託管與 WebSocket。
- **Rationale**: 確保 API 路由與前端代碼始終同步，不會有 404。

### 3. 使用 `@runflow/workspace` 作為核心依賴
Viewer Server 不再自己掃描磁碟，而是調用 `workspace` 包中的邏輯。
- **Rationale**: 確保 ID 到檔案路徑的映射在整個專案中完全一致。

### 4. WebSocket 訊息增量同步 (Context Push)
當 `dev` 模式啟動或熱重載時，CLI 直接將完整的 Flow Context (Graph + Params) 推送到 Viewer。
- **Rationale**: 避免 Viewer 在預覽模式下還去 Fetch API，減少延遲與失敗率。

## Risks / Trade-offs

- **[Risk]** Package 循環依賴 → **Mitigation**: 確保 `workspace` 與 `core` 不依賴 `viewer`。
- **[Risk]** CLI 建置體積變大 → **Mitigation**: 使用 `tsup` 進行 Tree-shaking 最佳化。
