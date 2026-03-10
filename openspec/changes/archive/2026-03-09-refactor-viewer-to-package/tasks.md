## 1. 基礎架構遷移 (搬遷並重新定義為 `@runflow/viewer`)

- [x] 1.1 將 `apps/flow-viewer` 目錄完整遷移至 `packages/viewer`。
- [x] 1.2 更新 `pnpm-workspace.yaml` 與 `package.json` 中的路徑引用與 Package Name (`@runflow/viewer`)。
- [x] 1.3 調整 `turbo.json` 以確保建置依賴關係正確。

## 2. Viewer Server 函式庫實作 (Viewer SHALL be available as a library)

- [x] 2.1 在 `packages/viewer/server` 建立伺服器進入點，導出 `startViewerServer` 工廠函數 (封裝 `startviewerserver` 工廠函數)。
- [x] 2.2 整合靜態資源託管 (sirv) 與 WebSocket Server (ws) 至同一個伺服器實例。
- [x] 2.3 確保伺服器接受並使用傳入的 `workspaceConfig` 與 `port` 參數。

## 3. 統一工作區解析邏輯 (Viewer Server SHALL use shared workspace logic)

- [x] 3.1 在 `packages/viewer/server` 中移除重複的檔案掃描邏輯，改為引用 `@runflow/workspace` (使用 `@runflow/workspace` 作為核心依賴)。
- [x] 3.2 驗證 Viewer Server 與 CLI 使用相同的 `resolveFlowId` 邏輯。

## 4. CLI 整合與 Dev 模式升級 (CLI SHALL provide a dev command for hot reload)

- [x] 4.1 修改 `apps/cli` 的 `package.json`，新增對 `@runflow/viewer` 的依賴。
- [x] 4.2 重構 `apps/cli/src/dev.ts`，移除手動啟動伺服器的邏輯，改為調用 `startViewerServer` (CLI SHALL embed a WebSocket server for status push)。
- [x] 4.3 實作增量同步邏輯，在熱重載時推送完整的 Flow Context (WebSocket 訊息增量同步 (context push))。

## 5. Viewer 初始化優化 (Viewer SHALL support WebSocket connection for live updates)

- [x] 5.1 修改 `apps/flow-viewer/src/hooks/use-flow-graph.ts`，確保在 `ws` 模式下能正確處理 `FLOW_RELOAD` 中的完整 context。
- [x] 5.2 修正參數介面 (Params) 的載入邏輯，優先使用 WebSocket 傳來的宣告數據。

## 6. 驗證與清理

- [x] 6.1 驗證 `flow dev test --open` 能正確啟動、解析子流程並顯示參數。
- [x] 6.2 移除 `apps/cli` 中不再需要的 `postbuild` 複製腳本與冗餘依賴。
