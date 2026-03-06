## Context

目前 `RunResult` 的格式化邏輯在 `packages/workspace/src/format.ts` 中，它會遍歷所有執行過的步驟並顯示其狀態、ID 與 Log。HTTP 處理器目前會在成功時輸出 Body，且 `sleep` 處理器預設會輸出睡眠時長。

## Goals / Non-Goals

**Goals:**
- 將 `RunResult` 的總結輸出縮減 50% 以上。
- 確保所有失敗的步驟與帶有自定義日誌的步驟依然可見。
- 將 Body 詳細資訊保留給 `inspect` 指令，而非 `run` 指令。

**Non-Goals:**
- 修改 `RunResult` 資料結構本身（只修改呈現方式）。
- 修改 `verbose` 模式下的完整輸出。

## Decisions

### 1. 修改 `formatRunResult` 過濾邏輯
過濾掉所有 `success: true` 且 `log` 為空或僅含空白字元的步驟。這樣 `set`、`noop` 以及沒有分支日誌的步驟將被隱藏。

### 2. 精簡與增強 HTTP Handler 日誌
- 在 `packages/handlers/src/http.ts` 中，將 `log` 組合邏輯改為僅包含狀態線。
- 新增 `successCondition` 選填欄位，並使用 `packages/core` 中的 `evaluate` 方法。
- 若 `successCondition` 評估為 `false`，則將步驟標記為 `success: false`，並像 `!response.ok` 一樣輸出 Body。

### 3. 語意化執行總結 (Semantic Summary)
- 在 `formatRunResult` 中修改 `formatStepIdDisplay`：
  - 如果步驟有 `name` 欄位（需在執行結果中包含此欄位），則優先顯示 `name`。
  - 將 `iteration_N` 路徑轉換為 `[Iteration N]`。
- 移除輸出的 `log:` 前綴，改用中劃線銜接。

### 4. 移除 Sleep Handler 預設日誌
在 `packages/handlers/src/sleep.ts` 中，刪除 `run` 方法回傳的 `log` 欄位。

### 4. 移除迭代標記行
在 `formatRunResult` 中移除針對 `iteration_n` 的特殊標記邏輯。由於 `stepId` 已包含 iteration 資訊，獨立的標記行在精簡模式下顯得贅餘。

## Risks / Trade-offs

- **[Risk] 使用者可能困惑步驟消失了** → [Mitigation] 在 CLI 指引中告知使用者可以使用 `inspect` 查看完整執行細節，或在 `verbose` 模式下查看全路徑。
