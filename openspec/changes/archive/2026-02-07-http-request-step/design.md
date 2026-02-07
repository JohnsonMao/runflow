# Design: HTTP 請求步驟

## Context

- **Executor**：目前支援 `command` 與 `js` 步驟；context 累積 params 與前序步驟 outputs；對 command 的 `run` 做 substitute，對 js 注入 `params` 並將回傳 object 合併進 context。
- **Parser**：依 `type` 分派為 FlowStepCommand 或 FlowStepJs；未識別 type 或必填欄位缺失則回傳 null。
- **StepResult**：已有 `outputs?: Record<string, unknown>`，executor 會將 outputs 合併進 context。
- **Substitute**：已實作 `substitute(template, context)`，支援 `{{ key }}`、dot、`[index]`，object/array 以 JSON.stringify。

## Goals / Non-Goals

**Goals:**

- 新增 step type `http`：必填 `url`；選填 method、headers、body、output、allowErrorStatus。
- 所有字串欄位（url、method、headers 各值、body）執行前以當前 context 做 substitute。
- 可配置 output key：有 `output` 時用其值作為寫入 context 的 key，否則用 step `id`。
- allowErrorStatus：為 true 時非 2xx 仍寫入 response 到 context，該步仍標記 `success: false`。
- 回應形狀為 `{ statusCode, headers, body }`；body 依 Content-Type 決定字串或 parsed object。

**Non-Goals:**

- 不實作重試、timeout、request/response schema 驗證、bodyFile。

## Decisions

### Decision 1: FlowStepHttp 型別

- **FlowStepHttp**：`{ id: string, type: 'http', url: string, method?: string, headers?: Record<string, string>, body?: string, output?: string, allowErrorStatus?: boolean }`。
- **FlowStep**：union 擴充為 `FlowStepCommand | FlowStepJs | FlowStepHttp`。
- Parser：`type === 'http'` 且 `url` 為字串時成立；method、headers、body、output、allowErrorStatus 選填；headers 須為 key-value 字串；allowErrorStatus 為布林（YAML 可為 true/false）。

### Decision 2: HTTP 實作與環境

- 使用 **Node 18+ 內建 `fetch`**（global fetch），不新增依賴。若執行環境無 fetch（理論上 Node 18 已內建），可於 runHttpStep 內 fallback 或拋出明確錯誤。
- 不採用 node:http 手動組裝，以保持程式簡潔；fetch 足夠涵蓋 GET/POST、headers、body。

### Decision 3: Substitute 套用範圍

- 對 http 步驟：執行前對 `step.url`、`step.method`（若存在）、`step.headers` 每個 value、`step.body`（若存在）逐一做 `substitute(field, context)`，再傳入 HTTP client。
- headers 的 key 不做替換（僅 value 替換），避免動態 key 增加複雜度；若未來需要可由 spec 擴充。

### Decision 4: 回應形狀與 body 解析

- 寫入 context 的 value 形狀：**`{ statusCode: number, headers: Record<string, string>, body: unknown }`**。headers 可為 node fetch 回傳的 Headers 轉成 plain object（key 小寫或保留原始，由實作決定）。
- **body**：若 response `Content-Type` 含 `application/json`，則 `body = await response.json()`；否則 `body = await response.text()`（故為 string）。實作時注意 consume body 一次。

### Decision 5: Output key 與合併

- **outputKey**：`step.output ?? step.id`。寫入 context 時：`context[outputKey] = { statusCode, headers, body }`。
- Executor 邏輯與 js 一致：`result.outputs = { [outputKey]: responseObject }`，然後 `context = { ...context, ...result.outputs }`。

### Decision 6: allowErrorStatus 與 success

- **allowErrorStatus === true**：不論 status code，皆將 response 寫入 outputs 並合併進 context；該步 **仍** 設 `success: false`（非 2xx 時），以便 RunResult 與後續邏輯能區分「有錯誤狀態但繼續跑」。
- **allowErrorStatus 未設或 false**：僅 2xx 時寫入 outputs 並設 success true；非 2xx 時 success false、不寫入 outputs（或僅在 error 欄位寫入訊息）。

### Decision 7: 網路錯誤與例外

- 請求拋錯（網路錯誤、invalid URL、timeout 等）：catch 後設 `success: false`、`error` 為訊息；不寫入 outputs。與現有 js/command 錯誤處理一致。

### Decision 8: DryRun

- `dryRun: true` 時，http 步驟不發送實際請求；可產出佔位 StepResult（success: true，無 outputs 或 outputs 為空），與 command/js 的 dryRun 行為一致。實作可選：本階段可讓 http 在 dryRun 時也回傳一筆佔位 result 即可。
