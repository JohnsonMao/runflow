# Proposal: 流程步驟間傳參與執行時傳參

## Why

1. **執行時傳參**：目前執行 flow 時無法從外部帶入參數（例如 `flow run flow.yaml --param a=1`），無法依環境或呼叫端動態傳值。
2. **步驟間傳參**：步驟之間無法傳遞資料；前一步的結果無法被後續步驟使用，難以組成有狀態的多步驟流程。
3. **累積式 context**：需要明確的語意：第 N 步可取得「執行時傳入的參數」加上「前面所有步驟輸出的參數」，並可選擇輸出自己的參數給後續步驟使用。

## What Changes

- **執行時參數**：CLI 支援 `--param key=value`（可多個），解析後以 key-value 形式傳入 core；`run(flow, options)` 的 `options` 擴充為可帶入 `params: Record<string, string>`（或擴充為支援簡單型別）。
- **步驟輸入**：每個步驟執行時可取得一個「當前 context」：初始為執行時參數，每執行完一步則將該步的輸出（若有）合併進 context，後續步驟看到的即為「執行時參數 + 前面所有步驟輸出」的累積結果。
- **步驟輸出**：步驟可選擇輸出自己的參數（key-value）。實作上可先支援 `js` 步驟透過約定（例如 `return { key: value }` 或寫入某個 context 物件）產出輸出；`command` 步驟可選支援（例如約定 stdout 最後一行為 JSON 則解析為輸出），或列為後續擴充。
- **型別與 API**：`StepResult` 可擴充 `outputs?: Record<string, unknown>`；`run(flow, options)` 新增 `params?: Record<string, string>`（或 `Record<string, unknown>`）；executor 內部維護累積的 context，每步執行前注入、執行後依輸出合併。
- **YAML 語意**：若需在 YAML 中宣告步驟的「輸入/輸出」或預設值，可在 design 階段決定；本 proposal 先以「執行時傳參 + 跨步驟累積傳參」的執行模型為主。

## 執行模型（跨步驟傳參）

- 執行時透過 CLI 傳入參數，例如：`flow run flow.yaml --param a=1 --param b=2`。
- **初始 context** = 執行時參數 `{ a: '1', b: '2' }`。
- **第 1 步**：輸入 = 初始 context。可輸出自己的參數（例如 `{ x: 'step1' }`）。執行後 context = `{ a: '1', b: '2', x: 'step1' }`。
- **第 2 步**：輸入 = 上述 context（執行時參數 + 第 1 步輸出）。可再輸出參數（例如 `{ y: 'step2' }`）。執行後 context = `{ a: '1', b: '2', x: 'step1', y: 'step2' }`。
- **第 3 步**：輸入 = 執行時參數 + 第 1、2 步輸出。可再輸出；依此類推。
- **第 N 步**：輸入 = 執行時參數 + 第 1 ～ N-1 步的輸出；可選擇輸出自己的參數供後續步驟使用。

同一 key 若多步都有輸出，可採用「後寫覆蓋」或「僅首次寫入」等策略，在 design 階段決定。

## Capabilities

### New Capabilities

- **執行時傳參**：`flow run <file> --param k=v` 將參數傳入 engine；core `run(flow, options)` 接受 `options.params`。
- **累積式 context**：每一步執行時可讀取「執行時參數 + 前面所有步驟的輸出」；執行後可選擇寫回自己的輸出，納入 context 供後續步驟使用。
- **步驟輸出**：至少 `js` 步驟能透過約定方式產出 key-value 輸出；`StepResult` 可帶 `outputs` 供除錯與後續擴充。

### Modified Capabilities

- **Executor**：`run()` 接受 `params`，內部維護 context，每步執行前注入、執行後依該步輸出合併。
- **StepResult**：可選欄位 `outputs?: Record<string, unknown>`。
- **CLI**：`flow run` 解析 `--param key=value` 並傳入 core。

## Impact

- `packages/core/src/types.ts`: 擴充 `StepResult` 的 `outputs`；`run` 的 options 型別擴充 `params`。
- `packages/core/src/executor.ts`: 接受 `params`，維護累積 context；執行每步時注入 context，並依步驟輸出合併；必要時將 context 傳給 `runJsStep` / `runCommandStep`（例如 js 的 vm context 可包含 `params` 或 `context`）。
- `apps/cli/src/cli.ts`: 解析 `--param k=v`，組成 `params` 物件傳給 `run(flow, { params })`。
- 若 YAML 需支援步驟層級的 params 宣告或預設值，將影響 `parser.ts` 與 step 型別，留待 design 細化。
