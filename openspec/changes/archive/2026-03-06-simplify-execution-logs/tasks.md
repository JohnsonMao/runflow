## 1. 修改 Handler 預設日誌

- [x] 1.1 修改 `http-request-step` 的 `http` handler，實作 `Step execution logging` 規範：預設僅輸出狀態線日誌，成功時隱藏 Body。
- [x] 1.2 在 `http` handler 實作 `Application-level success condition`：支援 `successCondition` 表達式判定，失敗時標記 `success: false` 並顯示 Body。
- [x] 1.3 修改 `sleep-step` 的 `sleep` handler，實作 `Execution logging` 規範：移除預設的「已睡眠」執行日誌輸出。

## 2. 修改 CLI 顯示邏輯

- [x] 2.1 修改 `packages/core` 引擎，讓 `StepResult` 包含步驟的 `name`。
- [x] 2.2 更新 `formatRunResult` 的 `Step display in run summary` 邏輯：根據 `Step logs for execution flow` 規範隱藏成功且無 log 的步驟。
- [x] 2.3 實作語意化輸出：優先顯示 `name`，將迭代路徑轉換為 `[Iteration N]` 格式，並移除 `log:` 前綴。
- [x] 2.4 在 `formatRunResult` 中實作 `No iteration markers`：移除獨立的迭代標記行。

## 3. 驗證與測試

- [x] 3.1 更新測試案例，確保語意化與 HTTP 成功判定符合預期。
- [x] 3.2 驗證 `verbose` 模式仍可查看到完整資訊。
... Applied fuzzy match at line 1-13.
