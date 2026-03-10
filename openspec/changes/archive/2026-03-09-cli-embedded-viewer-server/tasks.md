## 1. 基礎準備與依賴安裝

- [x] 1.1 在 `apps/cli` 中安裝 `sirv` 與 `@types/sirv` 依賴。 (sirv 內建型別，僅安裝 sirv)
- [x] 1.2 確保 `apps/flow-viewer` 的建置產物路徑在 Monorepo 中可被正確引用。

## 2. CLI 靜態伺服器實作 (CLI SHALL support hosting static viewer assets)

- [x] 2.1 在 `apps/cli/src/dev.ts` 中使用 `sirv` 作為靜態檔案伺服器，並實作「靜態資源的定位機制」。
- [x] 2.2 實作「動態連接埠分配」，讓 HTTP 伺服器與 WebSocket 伺服器能協同運作。
- [x] 2.3 確保 `flow dev` 指令啟動時，會同時啟動 HTTP 伺服器來託管 Viewer (CLI SHALL support hosting static viewer assets)。

## 3. 開啟邏輯與指令擴展 (CLI SHALL prioritize local viewer for --open)

- [x] 3.1 修改 `flow dev` 的 `--open` 參數處理邏輯，預設開啟本地 HTTP 伺服器網址 (CLI SHALL prioritize local viewer for --open)。
- [x] 3.2 確保傳遞給本地 Viewer 的 WebSocket 連線參數（如 `?ws=...`）正確。
- [x] 3.3 更新 `cli-dev-mode` 指令行為，整合本地伺服器啟動後的網址開啟邏輯 (CLI SHALL provide a dev command for hot reload)。
- [x] 3.4 整合 WebSocket Server 啟動邏輯 (CLI SHALL embed a WebSocket server for status push)。

## 4. 建置流程與發佈優化

- [x] 4.1 調整 Turborepo 配置，確保 `flow-viewer` 的建置任務先於 `cli` 的封裝任務。
- [x] 4.2 實作 CLI 建置時的靜態資源拷貝邏輯，將 `flow-viewer/dist` 拷貝至 `cli/dist/viewer`。

## 5. 驗證與測試

- [x] 5.1 驗證在離線狀態下，`flow dev --open` 仍能正常開啟並顯示流程圖。
- [x] 5.2 驗證熱重載與執行狀態推播在本地託管環境下運作正常。
