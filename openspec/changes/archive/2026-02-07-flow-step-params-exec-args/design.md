# Design: 流程步驟間傳參與執行時傳參

## Context

- **Executor**：`run(flow, options)` 目前只接受 `dryRun`；無 `params`。執行步驟時不注入任何 context，步驟之間無共享狀態。
- **StepResult**：僅有 `stepId`、`success`、`stdout`、`stderr`、`error`；無 `outputs`。
- **CLI**：`flow run <file>` 僅支援 `--dry-run`、`--verbose`；無 `--param`。
- **JS 步驟**：`runInNewContext` 只注入 `console`；無法讀取執行時參數或前序步驟輸出，也無法回傳結構化輸出給後續步驟。

## Goals / Non-Goals

**Goals:**

- 執行時可傳入參數：CLI `--param key=value`，core `run(flow, { params })`。
- 累積式 context：每步執行時可讀取「執行時參數 + 前面所有步驟的輸出」；執行後可產出 key-value 輸出，合併進 context 供後續步驟使用。
- 至少 **js** 步驟能讀取當前 context 並產出 `outputs`；`StepResult` 帶 `outputs`。
- 同一 key 多步都輸出時，語意明確（見決策）。

**Non-Goals:**

- 本階段不在 YAML 中宣告步驟的 inputs/outputs 或預設值；僅在執行期由 context 與步驟輸出決定。
- **command** 步驟產出結構化 outputs（例如解析 stdout 最後一行為 JSON）列為後續擴充；本設計可預留介面，實作可為空。
- 參數型別系統（驗證、轉型）與進階合併策略（merge 物件等）留待後續。

## Decisions

### Decision 1: 參數與 context 型別

- **執行時參數**：`options.params` 型別為 `Record<string, string>`。CLI 傳入的 `--param k=v` 一律為字串；若未來要支援數字/布林，可在 CLI 或 core 層做簡單轉型，本階段保持字串。
- **Context**：與 params 同型別，`Record<string, string>`。步驟輸出的 value 若為非字串（例如 js 回傳數字、物件），在合併進 context 前做 `String(value)` 或 JSON 序列化，由實作決定；型別上可放寬為 `Record<string, unknown>` 在 executor 內部使用，合併進「給下一步的 context」時再正規化為字串，以利 command 步驟未來可讀取環境變數等。
- **實作建議**：內部 context 使用 `Record<string, unknown>`，傳給 js 的 vm context 時原樣傳入；合併進下一步時，若 value 為 primitive 或可 JSON 的物件，可統一 `typeof value === 'string' ? value : JSON.stringify(value)`，以保持簡單。CLI 的 `params` 仍為 `Record<string, string>`。

### Decision 2: 同一 key 覆蓋策略

- **後寫覆蓋**：若第 1 步輸出 `{ x: '1' }`，第 2 步輸出 `{ x: '2' }`，則後續步驟看到的 `x` 為 `'2'`。實作簡單、語意直觀。

### Decision 3: CLI `--param` 語法

- 格式：`--param key=value`。key 與 value 以第一個 `=` 切開；value 可為空（`--param k=`）。
- 多個：可重複 `--param`，例如 `flow run flow.yaml --param a=1 --param b=2`。
- 重複 key：後者覆蓋前者（與累積 context 的後寫覆蓋一致）。
- 解析由 CLI 負責，傳入 core 的為 `Record<string, string>`。

### Decision 4: Core API

- **run(flow, options)**：`options` 擴充為 `{ dryRun?: boolean, params?: Record<string, string> }`。`params` 為可選；未傳時等同 `{}`，context 初始為空。
- **StepResult**：新增可選欄位 `outputs?: Record<string, unknown>`。僅在該步有產出時存在；dryRun 時可不設或設為 `{}`。

### Decision 5: Executor 累積 context 流程

1. 初始化：`context = { ...options.params }`（深拷貝或淺拷貝均可，params 為字串 key-value）。
2. 對每個步驟：
   - 將當前 `context` 注入該步（js 步驟傳入 vm context；command 步驟本階段不注入，預留介面即可）。
   - 執行該步，取得 `StepResult`（含可選 `outputs`）。
   - 若 `result.outputs` 存在且為物件，則 `context = { ...context, ...result.outputs }`（後寫覆蓋）。
3. 最後 context 僅用於執行過程，不寫回 `RunResult`；若未來需要「最終 context」可再擴充。

### Decision 6: JS 步驟如何讀取 context 與產出 outputs

- **讀取**：執行 js 時，在 vm context 中注入 `params`（唯讀），即當前累積的 context。例如 `params.a`、`params.x`。不讓步驟改寫 `params`，避免混淆；步驟輸出只透過回傳或專用介面。
- **產出**：
  - **方案 A**：步驟程式碼的「回傳值」作為 outputs。將現有 `(function(){ ${code} })()` 改為 `(function(){ return (${code}); })()` 並取 return value；若為 plain object（且非 null），則視為 `outputs`。需注意原 code 可能是多個語句無 return，則為 `undefined`，不合併。
  - **方案 B**：在 vm context 提供 `outputs` 物件，步驟寫入 `outputs.key = value`，執行後將該物件當作該步的 outputs 合併進 context。
- **採用方案 A**：與現有「單一表達式或最後一個表達式」常見用法相容；若 script 是 `const x = params.a; return { out: x };` 則可產出。多語句且無 return 則該步無 outputs，不影響既有行為。實作時 wrap 成 function 並取返回值，若為 object 且 `!== null` 且非 Array（或允許 Array），則設為 `result.outputs`。

### Decision 7: Command 步驟與 outputs

- 本階段 **不** 實作 command 步驟的結構化 outputs（不解析 stdout）。`runCommandStep` 回傳的 `StepResult` 不設 `outputs`。若未來要支援（例如最後一行 JSON），可在同一 `StepResult.outputs` 欄位擴充，executor 合併邏輯已通用。

### Decision 8: DryRun 與 params

- `dryRun: true` 時仍可傳入 `params`；執行時不跑實際步驟，context 不更新，steps 僅為佔位結果。若希望 dryRun 時也模擬 context 傳遞，可列為後續；本階段 dryRun 不處理 params/context。
