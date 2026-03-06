## Context

目前 Runflow 引擎（`packages/core`）採用 Wave 模式執行 DAG 中的步驟。當一個步驟失敗時，引擎會將其標記為失敗，但仍會繼續執行該 Wave 中其他獨立的步驟，且會發送下一個 Wave（只要該 Wave 的依賴項在邏輯上仍能滿足或不受失敗影響）。

此外，API 呼叫（`http` handler）的日誌記錄過於簡略或過於冗長（包含敏感資訊），且缺乏機制讓 AI 在不重複執行 API 的情況下獲取被截斷的詳細資料。

## Goals / Non-Goals

**Goals:**

- 實作引擎級別的中斷控制（`continueOnError`）。
- 建立安全且具備智能截斷功能的 API 日誌規範。
- 實作執行快照機制與配套的查詢工具（`inspect`）。
- 增強表達式引擎以支援常用的陣列操作。

**Non-Goals:**

- 不支援任意 JavaScript 函數執行（僅限白名單內的陣列方法）。
- 不實作多版本的執行歷史記錄（僅保留 `latest.json`）。
- 本次不針對非 API 相關的 handler（如 `js`, `command`）進行日誌安全性優化。

## Decisions

### 1. 引擎中斷邏輯實作

在 `packages/core/src/engine.ts` 的 `executeFlow` 函式中，每完成一個 Wave 的執行後，應檢查該 Wave 中是否有任何步驟的 `success` 為 `false` 且其 `continueOnError` 為 `false`（且全域 `RunOptions.continueOnError` 也為 `false`）。若滿足條件，則終止後續所有 Wave 的發送。

- **理由**: 確保流程在關鍵步驟失敗時能立即停止，避免不必要的副作用。

### 2. API 日誌的去敏感與摘要

在 `packages/handlers/src/http.ts` 中引入日誌處理工具。
- **Redaction**: 使用黑名單對 Header（Authorization, Cookie）與 Body 欄位（password, token, secret）進行遞迴遮蔽。
- **Summarization**: 針對大型 Body（> 2048 chars）進行截斷，並附加導引文字至快照。

- **理由**: 平衡除錯需求與 Token 消耗/資訊安全。

### 3. 表達式引擎 (safe-expression) 增強

修改 `packages/core/src/safeExpression.ts` 中的 `resolvePath` 或其底層解析邏輯，識別 `.map()`, `.filter()`, `.slice()` 等語法。這不需要完整的 JS Parser，可以透過簡單的符號識別與對應的內部函式來模擬。

- **理由**: 讓 AI 能夠在 Flow 定義或 `inspect` 指令中精準地從大量資料中過濾出關鍵欄位（如 IDs），大幅減少 Context 壓力。

### 4. 快照儲存與 Inspect 指令

- **儲存**: 在 `executor.ts` 完成執行後，將 `RunResult` 物件序列化並儲存至工作目錄下的 `.runflow/runs/latest.json`。
- **查詢**: CLI 新增 `inspect` 指令，讀取 `latest.json` 並套用 `resolvePath` 邏輯回傳結果。

- **理由**: 解決 AI 為了獲取詳細資訊而被迫重複執行非等冪 API 的痛點。

## Risks / Trade-offs

- **[Risk] 表達式引擎安全性** → **[Mitigation]** 嚴格限制僅能使用預定義的白名單方法，不使用 `eval`，所有過濾邏輯均由 TypeScript 程式碼模擬。
- **[Risk] 快照檔案大小** → **[Mitigation]** 預設僅保留 `latest.json`。若未來有需求，再考慮壓縮或清理策略。
- **[Risk] 過度攔截導致除錯困難** → **[Mitigation]** 僅遮蔽已知的敏感欄位名稱，使用者仍可透過 `inspect` 查看到未被截斷（但仍會被遮蔽）的完整結構。
