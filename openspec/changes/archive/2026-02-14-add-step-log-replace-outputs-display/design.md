# Design: StepResult 新增 log、移除 stdout/stderr

## Context

Execute 工具與 CLI --verbose 目前會列出每個 step 的完整 outputs 及 stdout/stderr，導致 HTTP、loop 等 step 的輸出體積過大。引入 **log** 作為「對外顯示用的一行摘要」，由各 handler 自行填入；同時自 **StepResult** 型別移除 **stdout**、**stderr**，統一以 log 作為顯示來源。

**約束**：outputs 仍保留於 StepResult，供 executor 累積 context 與後續 step 使用；僅「對外展示」改為 log，不改變執行語意。

## Goals / Non-Goals

**Goals:**

- StepResult 移除 `stdout`、`stderr`；新增可選 `log?: string`。StepResultOptions 同步移除 stdout/stderr、新增 log。
- `stepResult()` 不再設定 stdout/stderr，改為可選設定 `opts.log`。
- MCP `formatRunResult`：對每個 step 只輸出 success/stepId、error（若失敗）、以及 `log`（若有）；不再輸出 stdout、stderr、outputs。
- CLI `--verbose`：對每個 step 改為輸出 `step.log`（若有）及既有 outputs/error 行為（或僅 log + error，依實作取捨）。
- 各內建 handler（set、condition、loop、http、flow、sleep）可於回傳 stepResult 時填入適當的 log，供 MCP/CLI 顯示；未填則該 step 僅顯示 ✓/✗ + stepId。

**Non-Goals:**

- 不改變 RunResult.steps 的結構（仍為 StepResult[]）；不移除 outputs。
- 不強制所有 handler 必須填 log；未填時顯示仍可運作。

## 型別與 stepResult()

- **StepResult**（packages/core/src/types.ts）：
  - 移除：`stdout: string`、`stderr: string`。
  - 新增：`log?: string`（可選，供 MCP/CLI 顯示用的一行摘要）。
- **StepResultOptions**：移除 `stdout?`、`stderr?`；新增 `log?: string`。
- **stepResult()**（packages/core/src/stepResult.ts）：建構 StepResult 時不再寫入 stdout/stderr；若 `opts.log` 有值則寫入 `out.log`。

## MCP formatRunResult

- **輸入**：`RunResult`（steps 為 StepResult[]，已無 stdout/stderr）。
- **輸出**：第一行為 Success/Failed + flow name + step 數；其後每個 step 一行 `- ✓ stepId` 或 `- ✗ stepId`，若該 step 有 `error` 則下一行 `  error: ...`，若該 step 有 `log` 則下一行 `  log: ...`。
- **不再輸出**：stdout、stderr、outputs。

## CLI --verbose

- 對每個 step：若有 `step.log` 則寫入 `process.stdout`（例如 `${step.log}\n`）；若有 `step.outputs` 可維持現有 JSON 輸出或改為不輸出（依產品取捨）；若有 `step.error` 則寫入 stderr。
- 不再讀取或輸出 `step.stdout`、`step.stderr`。

## 各 Handler 的 log 策略（建議）

| Handler | 成功時 log 建議 | 失敗時 |
|---------|-----------------|--------|
| set     | 列出 set 的 key，如 `set keys: a, b` | error 已有，可不填 log |
| condition | 分支摘要，如 `branch: then` 或 `branch: else` | error 已有 |
| loop   | 迭代摘要，如 `iterations: 3` 或 `items: 5` | error 已有 |
| http   | 簡短摘要，如 `GET <url> → 200` | error 已有 |
| flow   | 如 `flow <path> → success` 或 `→ failed` | error 已有 |
| sleep  | 如 `slept 1s` 或 `slept 100ms` | error 已有 |

以上可於本 change 一併實作，或列為後續 task；未填 log 時 MCP/CLI 仍可正常顯示 stepId + ✓/✗。

## 測試與相容

- 所有建構或回傳 StepResult 的地方須移除 stdout/stderr：executor、stepResult()、loop.test / executor.test / validateCanBeDependedOn.test 的 mock、mcp-server 與 cli 的 fixtures、cli.test 的內聯 handler（改為回傳 `log` 取代 `stdout`）。
- CLI 測試中依賴「step 輸出出現在 process.stdout」的 assertion，改為依賴 step.log 被 CLI 寫入 stdout，因此內聯 handler 改回傳 `log: "..."`。

## 架構規範

- Core 不依 step.type 解讀 log 內容；log 純為 handler 提供、供顯示用。Executor 僅透傳 StepResult，不修改 log。
