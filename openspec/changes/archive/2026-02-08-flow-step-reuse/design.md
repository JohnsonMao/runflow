# Design: Flow Step Reuse (flow-call step)

## Context

Runflow 的 executor 目前只執行單一 `FlowDefinition`：透過 `run(flow, options)` 依 DAG 順序執行 steps，並累積 context（params + 各 step 的 outputs）。Loader 提供 `loadFromFile(path)` 回傳 `FlowDefinition | null`。沒有「在一個 step 內執行另一個 flow」的能力；loop 的 `runSubFlow` 僅針對**同一 flow 內**的 step ids 子圖。

要達成 flow 重用，需要一個新 step type，在執行時載入並執行另一個 flow、傳入參數、並將被呼叫 flow 的結果合併回呼叫端。

## Goals / Non-Goals

**Goals:**

- 支援 step type `flow`（或 `call-flow`），指定被呼叫的 flow 來源（檔案路徑）、傳入 params、並將被呼叫 flow 的 outputs 合併進本 step 的 StepResult.outputs，供後續 steps 使用。
- 路徑解析以呼叫端 flow 的 `flowFilePath` 為 base（相對路徑），或支援絕對路徑；與現有 loader 與 executor 整合，不新增外部依賴。
- 被呼叫 flow 執行失敗時，flow-call step 回傳失敗 StepResult（success: false），錯誤資訊可傳遞。

**Non-Goals:**

- 本階段不實作「只執行另一 flow 內指定 step ids」的 sub-flow（可列為後續擴充）。
- 不支援動態 registry 傳遞（被呼叫 flow 使用與主 flow 相同的 default registry）。
- 不變更現有 step 類型或 StepContext 的既有契約。

## Decisions

### 1. Step type 名稱：`flow`

使用 `type: 'flow'`，與既有 `command`、`js`、`loop` 等一致。別名 `call-flow` 可不實作，以保持 YAML 簡潔。

**替代方案**：`call-flow` — 語意明確但較長；擇一即可。

### 2. 指定被呼叫 flow：單一欄位 `flow`（路徑字串）

Step 必填欄位：`flow: string`，表示被呼叫 flow 的檔案路徑。相對路徑以 `context.flowFilePath` 所在目錄為 base（若無 flowFilePath 則以 process.cwd() 為 base）。絕對路徑則直接使用。

**替代方案**：`path` + `ref` 分開 — 增加複雜度且目前無需 ref 註冊表；單一 `flow` 路徑足夠。

### 3. 參數傳遞：`params` 物件（可選）

Step 可選欄位：`params: Record<string, unknown>`。傳入被呼叫 flow 的 `run(flow, { params: { ...callerContext, ...stepParams } })`。實作上可選擇「僅傳 step 的 params」或「合併當前 context 再傳」；建議**僅傳 step 的 params**，避免意外洩漏呼叫端變數，且與「被呼叫 flow 為獨立單元」一致。若未提供 `params`，傳 `{}`。

**替代方案**：合併 caller context — 彈性高但容易造成隱性依賴；首版採顯式 params。

### 4. 輸出合併：被呼叫 flow 所有 step 的 outputs 合併為本 step 的 outputs

被呼叫 flow 執行完成後，將其實際執行到的各 step 的 `StepResult.outputs` 依執行順序合併（後寫覆蓋）成單一物件，作為 flow-call step 的 `StepResult.outputs`。與 step-context 的「later overwrites」一致。

**替代方案**：只取最後一步的 outputs — 語意簡單但資訊丟失；合併全部較符合「子 flow 回傳一包結果」的直覺。

### 5. 誰負責載入與執行：flow-call handler 內呼叫現有 loader + run

Handler 內：`loadFromFile(resolvedPath)` 取得 `FlowDefinition`；若為 null，回傳 `stepResult(id, false, { error: '...' })`。否則呼叫現有 `run(loadedFlow, { params, flowFilePath: resolvedPath })`。不把「載入另一 flow」放進 executor 核心，保持 executor 單一職責；handler 為唯一知道「需要另一份 flow」的單位。

**替代方案**：Executor 提供 `runFlow(path, params)` — 增加 executor API 表面積；由 handler 組裝 loader + run 即可。

### 6. flowFilePath 傳遞

`run(loadedFlow, { params, flowFilePath: resolvedPath })` 傳入被解析後的絕對路徑，使被呼叫 flow 內若有相對路徑（例如未來擴充的資源檔）可基於該檔案所在目錄解析。與現有 CLI 傳入 `flowFilePath` 行為一致。

### 7. Timeout / retry

flow-call step 支援 step 層級的 `timeout`、`retry`（由 executor 處理），與其他 step 一致。被呼叫 flow 內部各 step 的 timeout 獨立；flow-call 的 timeout 涵蓋「整段子 flow 執行」時間。

### 8. Flow-call 深度上限（必做）

為避免遞迴或過深巢狀（A → B → A 或 A → B → C → … 過長）導致堆疊或資源問題，**必須**強制 flow-call 深度上限。頂層 flow 的深度為 0，每進入一層 flow step 執行子 flow 則深度 +1。當**即將執行**的 flow 會使深度達到上限時，不執行該子 flow，flow-call step 直接回傳 StepResult success: false，error 註明為「max flow-call depth exceeded」或等同語意。

- **預設上限**：32（常數，可放在 constants.ts；足夠一般組合，又避免濫用）。
- **可選擴充**：RunOptions 可提供 `maxFlowCallDepth?: number` 覆寫預設值，供 CLI 或測試使用；未提供時使用預設 32。
- **傳遞方式**：executor 在建立 StepContext 時已知「目前深度」（從 run 的 options 或內部狀態傳入）；提供給 flow handler 的 `runFlow(path, params)` 在執行子 flow 時傳入 `currentDepth + 1`，並在進入 run 前檢查是否已達上限，若達上限則不呼叫 run、直接回傳失敗 RunResult 或由 handler 回傳失敗 StepResult。

**替代方案**：不限制深度 — 有遞迴與 DoS 風險；不採用。

## Risks / Trade-offs

- **路徑解析與安全性**：相對路徑若可跳出專案目錄，可能載入非預期檔案。Mitigation：以 `flowFilePath` 的 dir 為 base，不允許 `..` 超出該 base，或文件明確說明「僅限信任的 YAML」。
- **遞迴呼叫**：A 呼叫 B、B 再呼叫 A 會無限遞迴。Mitigation：**強制 flow-call 深度上限**（見決策 8），超過即失敗並回報錯誤。
- **錯誤語意**：子 flow 中某 step 失敗時，整個 RunResult.success 為 false；flow-call step 的 StepResult 也應為 false，並帶 error 或 stderr。Mitigation：將 RunResult.error 或最後失敗 step 的訊息放入 flow-call 的 StepResult.error。

## Migration Plan

- 純新增：新 step type、新 handler、註冊進 default registry。無既有 flow 需遷移。
- 若未來要支援「指定 step ids」子 flow，可在此 handler 上擴充（例如可選 `steps: string[]`），不影響現有「整份 flow 執行」行為。

### 9. 被呼叫 flow 的 params 驗證（必做）

被呼叫 flow 若有頂層 `params`（ParamDeclaration），傳入的 params **必須**依該宣告驗證。與現有 `run(flow, options)` 行為一致：executor 在 run 內已對 `options.params` 做 `paramsDeclarationToZodSchema` + safeParse，驗證失敗則回傳 RunResult success: false、error 為驗證錯誤訊息。flow-call handler 呼叫 `run(loadedFlow, { params })` 時，該驗證會自動執行；handler 僅需將 RunResult 的失敗（含 error 訊息）轉成 StepResult(success: false, error: RunResult.error)，不需在 handler 內重複實作驗證邏輯。

## Open Questions

- （無）
