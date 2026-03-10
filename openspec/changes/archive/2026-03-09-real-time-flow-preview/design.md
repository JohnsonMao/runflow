## Context

目前 Runflow CLI 在開發流程檔案時缺乏即時反饋機制。使用者修改 `flow.yaml` 後，需要手動重新執行指令來驗證結果。本設計方案旨在透過 `dev` 模式，結合檔案監聽與 WebSocket 技術，實現預覽介面的自動更新與執行狀態的即時推播。

## Goals / Non-Goals

**Goals:**
- 提供 `runflow dev` 指令，具備熱重載功能。
- 實現 CLI 與 `flow-viewer` 之間的雙向同步（結構與狀態）。
- 在 `packages/core` 中引入可擴充的執行鉤子。

**Non-Goals:**
- 不涉及在預覽器中直接編輯 YAML 並儲存回檔案系統的功能（僅唯讀預覽）。
- 不支援遠端連線（預設僅限 localhost 存取）。

## Decisions

### 1. 使用 Chokidar 進行檔案監聽
選擇 `chokidar` 作為監聽工具，因為它比原生 `fs.watch` 更穩定，且能處理跨平台的各種邊緣案例（如原子儲存）。

### 2. 整合 ws 建立輕量化 WebSocket Server
在 `apps/cli` 中直接內嵌一個基於 `ws` 的伺服器。這避免了引入龐大的 Socket.io 或額外的中介層，符合 CLI 輕量化的需求。

### 3. 在 Executor 中引入 Event-driven Hooks
在 `packages/core/executor.ts` 中實作一個簡單的事件發送器或回呼機制。當 Step 狀態從 `pending` -> `running` -> `success/failure` 時，會觸發對應的事件。
- **Rationale**: 讓 CLI 能在不干涉核心邏輯的情況下，訂閱執行進度。

### 4. WebSocket 通訊協議定義
採用簡約的 JSON 格式：
- `FLOW_RELOAD`: 當檔案變更時，傳送解析後的完整 graph 資料。
- `STEP_STATE_CHANGE`: 當單一節點狀態變更時，傳送增量更新。

## Risks / Trade-offs

- **[Risk]** 連線衝突 → **Mitigation**: 預設使用隨機或可配置的 Port，並在啟動時檢查可用性。
- **[Risk]** 檔案頻繁儲存導致重複重新解析 → **Mitigation**: 實作 Debounce 機制。
- **[Risk]** 核心引擎效能受 Hook 影響 → **Mitigation**: Hook 應以同步或異步非阻塞方式執行，若 Hook 失敗不應影響 Flow 主程序。
