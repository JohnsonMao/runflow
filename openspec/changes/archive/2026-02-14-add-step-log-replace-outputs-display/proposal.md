# Proposal: 擴充 step 結果的 log、MCP 改輸出 log 取代 outputs

## Why

目前 execute 工具回傳的內容會列出每個 step 的完整 `outputs`（以及 stdout/stderr），導致：
- HTTP、loop 等 step 的 outputs 體積大（整份 response、整段 context），不利閱讀與 MCP 客戶端解析。
- stdout/stderr 多為除錯用，在「結果摘要」情境下常屬多餘。

引入 **log** 欄位並改為「對外只顯示 log」可讓每個 handler 自行決定要暴露的簡短摘要，既保留 outputs 供後續 step 使用，又精簡顯示內容。

## What Changes

- **StepResult 擴充**：在 `StepResult` / `StepResultOptions` 新增可選 `log?: string`。handlers 透過 `context.stepResult(..., { log: '...' })` 填入適合給人看的摘要。
- **移除顯示 stdout/stderr**：MCP 的 `formatRunResult` 不再輸出 step 的 stdout、stderr。
- **MCP 改輸出 log**：`formatRunResult` 對每個 step 改為輸出 `log`（若有）；不再輸出整包 `outputs`。outputs 仍存在於 RunResult 供程式使用，僅對外展示改為 log。
- **各 handler 決定 log 內容**：set / condition / loop / http / flow / sleep（以及若有 command、js）各自在成功或失敗時設定合適的 log 字串（例如：set 列出 set 的 key、condition 列出分支、http 列出 method + url + status、loop 列出迭代次數等）。

## Capabilities

### New Capabilities

- **step-result-log**：StepResult 具備可選 `log`；MCP execute 結果以 log 作為每步的顯示內容，不再顯示 outputs/stdout/stderr。

### Modified Capabilities

- **mcp-server**：execute 工具回傳格式改為依 log 顯示每步摘要。
- **handlers**：各內建 handler 在回傳 stepResult 時填入 log（可與現有 outputs 並存）。

## Impact

- **@runflow/core**：types.ts 的 StepResult、StepResultOptions 新增 `log?: string`；stepResult() 支援 opts.log。
- **@runflow/handlers**：set、condition、loop、http、flow、sleep 等 handler 在 stepResult 時加上適當的 log。
- **apps/mcp-server**：formatRunResult 改為輸出 step.log，移除 stdout/stderr 與 outputs 的顯示。
- **既有 flow**：無須改 YAML；僅顯示格式與 step 回傳欄位變更。
