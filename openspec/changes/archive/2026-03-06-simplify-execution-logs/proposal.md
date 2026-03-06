## Why

當前的 Flow 執行結果輸出包含過多冗餘資訊（如 HTTP Body、Sleep Log、未發生變動的成功步驟等），導致終端機畫面雜亂，降低了開發者識別關鍵執行路徑與錯誤原因的效率。

## What Changes

- **精簡 HTTP Log**：預設僅顯示請求方法、URL 與狀態碼，不再顯示 Body 內容（除非失敗或開啟詳細模式）。
- **HTTP 成功判定邏輯**：新增 `successCondition` 參數，允許透過表達式判定 API 回傳內容是否真正成功（例如檢查 Body 欄位），若判定失敗則視為步驟失敗並顯示 Body。
- **語意化執行日誌 (Semantic Logs)**：
  - 優先顯示步驟的 `name` 而非 `id`。
  - 將迭代路徑轉換為易讀格式（例如：`[Iteration 1] Name`）。
  - 移除 `log:` 前綴，改用更自然的英文敘述。
- **移除無意義 Log**：移除 `sleep` 處理器的預設執行日誌。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `step-result-log`: 定義步驟日誌的精簡化規範，確保僅輸出具備除錯價值的新資訊。
- `http-request-step`: 調整 HTTP 步驟的預設日誌行為，預設隱藏 Body。
- `sleep-step`: 移除預設的「已睡眠」日誌輸出。
- `cli-flow-view`: 修改 CLI 格式化邏輯，過濾掉無 Log 的成功步驟並移除迴圈迭代標記。

## Impact

- 影響 `packages/handlers` 中的 `http` 與 `sleep` 處理器。
- 影響 `packages/workspace` 中的 `formatRunResult` 邏輯。
- 影響 `apps/cli` 的執行結果呈現。
