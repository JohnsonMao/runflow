## 1. 引擎中斷與核心機制實作

- [x] 1.1 在 `packages/core` 中實作 `FlowStep SHALL support continueOnError` 與 `RunOptions SHALL support continueOnError` 欄位定義
- [x] 1.2 在 `engine.ts` 中執行「引擎中斷邏輯實作」，當步驟失敗且 `continueOnError` 為 false 時中止後續 Wave
- [x] 1.3 實作 `Execution SHALL save results to snapshot` 邏輯，在執行結束後將 `RunResult` 寫入 `.runflow/runs/latest.json`

## 2. API 日誌與安全處理

- [x] 2.1 修改 `http` handler 以滿足 `http handler SHALL log response summary`，記錄方法、URL 與狀態碼
- [x] 2.2 執行「API 日誌的去敏感與摘要」設計，實作 `Sensitive data SHALL be redacted in logs` 遮蔽機制
- [x] 2.3 實作 `Large response bodies SHALL be truncated in logs`，針對超過 2048 字元的 Body 進行截斷並提示快照資訊

## 3. 表達式引擎增強

- [x] 3.1 執行「表達式引擎 (safe-expression) 增強」，在 `safeExpression.ts` 中實作 map, filter, slice 方法的模擬
- [x] 3.2 驗證 `Command step run SHALL support template substitution` 已支援新增的陣列處理語法

## 4. 查詢工具與 CLI/MCP 整合

- [x] 4.1 執行「快照儲存與 Inspect 指令」，實作 `CLI SHALL provide inspect command` 子指令
- [x] 4.2 實作 `MCP SHALL provide inspect tool` 讓 AI 能透過 MCP 接口查詢最新快照資料

## 5. 測試與驗證

- [x] 5.1 撰寫測試驗證 `FlowStep SHALL support continueOnError` 與 `RunOptions SHALL support continueOnError` 的各種中斷情境
- [x] 5.2 驗證 `api-logging-security` 中的敏感資訊遮蔽與大型資料截斷符合預期
- [x] 5.3 測試 `execution-snapshot-inspect` 的快照儲存完整性與 `inspect` 指令的查詢準確性
