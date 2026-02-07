# Design: 統一節點介面與註冊機制

## Context

- **現狀**：`executor.ts` 依 `step.type` 用 if/else 分派到 `runCommandStep`、`runHttpStep`、`runJsStep`；context 為累積的 `Record<string, unknown>`（初始為 params，每步成功時 merge 該步的 `outputs`）；`parser.ts` 的 `parseStep` 僅接受 `command` / `js` / `http`，並對每種 type 做專用欄位驗證，未知 type 直接 `return null`。
- **型別**：`FlowStep` 為 `FlowStepCommand | FlowStepJs | FlowStepHttp`，`StepResult` 已具備 `stepId, success, stdout, stderr, error?, outputs?`。
- **約束**：不考慮向後相容，可 breaking；需保留 substitute、params、flowFilePath、output 累積語意，以便內建與自訂節點行為一致。

## Goals / Non-Goals

**Goals:**
- 定義單一 **StepHandler** 介面與 **StepContext / StepResult** 契約，所有 step（含內建）皆透過此介面執行。
- 執行引擎僅依 **Registry**（type → handler）分派，無 type 專用分支。
- Parser 產出**通用 step**（id + type + 其餘 key-value），不再對 command/js/http 做專用驗證。
- 提供**預設 registry**（內建 command、js、http 以 handler 實作），並支援 `run(flow, options)` 傳入自訂或覆寫的 registry。

**Non-Goals:**
- 不在本設計內實作「依 YAML schema 在 parse 階段驗證自訂 type 欄位」；驗證可選由各 handler 或後續 spec 定義。
- 不處理遠端/動態載入 handler（例如從 URL 或 plugin 包）；僅支援呼叫端傳入的 registry。
- 不引入非同步以外的執行擴充（取消、重試、timeout）的介面變更；介面預留未來擴充即可。

## Decisions

### 1. StepHandler 簽名與 StepContext / StepResult

- **決策**：Handler 簽名定為  
  `(step: FlowStep, context: StepContext) => Promise<StepResult>`  
  或為與現有 http 一致而統一為 async；context 包含 `params`、`previousOutputs`（前序 steps 的 outputs 合併）、`flowFilePath`（可選）、必要時可加 `flowName`。
- **StepResult**：沿用現有 `StepResult`（stepId, success, stdout, stderr, error?, outputs?），不再新增欄位。
- **替代**：同步 `(step, context) => StepResult` 會讓 http 需包成 Promise，且未來若支援 I/O 統一 async 較簡單，故採用 async。

### 2. FlowStep 型別與 parser 產出

- **決策**：`FlowStep` 改為  
  `{ id: string; type: string; [key: string]: unknown }`  
  parser 對任意 `type`（string）皆產出此形狀，僅保證 `id`、`type` 存在；其餘 key 原樣保留，由對應 handler 解讀。
- **替代**：保留 union 會讓「自訂 type」無法在型別上表達，且 proposal 已接受 breaking，故改為通用形狀。

### 3. Registry 型別與註冊 API

- **決策**：Registry 型別為 `Record<string, StepHandler>`（type 字串 → handler）；提供 `createDefaultRegistry(): StepRegistry` 回傳內建 command/js/http，並可匯出 `registerStepHandler(registry, type, handler)` 或 `registry[type] = handler` 讓呼叫端擴充/覆寫。
- **替代**：`Map<string, StepHandler>` 亦可，但與現有 options 慣例（Record）一致且 JSON 友善，故用 Record。

### 4. 內建 handler 的安置與 substitute 時機

- **決策**：內建三個 handler 抽成獨立模組（例如 `handlers/command.ts`、`handlers/js.ts`、`handlers/http.ts`），內部邏輯與現有 `runCommandStep` / `runJsStep` / `runHttpStep` 一致；**替換（substitute）由 executor 在呼叫 handler 前對 step 的「字串值」做一層替換**，或約定由 handler 自行對收到的 step 做 substitute（context 提供 params + previousOutputs）。為單一責任與可測試性，建議 **executor 在呼叫前對 step 做 substitute**，傳入 handler 的 step 已是替換後 snapshot；context 僅提供讀取用資料。
- **替代**：若由各 handler 自行 substitute，則需把 `substitute` 與 context 傳入，較易出錯且重複；故由 executor 統一 substitute 再傳入 handler。

### 5. 未註冊 type 與錯誤處理

- **決策**：執行時若 `step.type` 不在 registry 中，該 step 回傳一個 `StepResult`（success: false, error: 如 "Unknown step type: xxx"），不 throw；整體 flow 的 success 依現有邏輯（任一步失敗即 false）。
- **替代**：throw 會中斷整條 flow 且需額外 try/catch，與現有「每步一 result」模型不一致，故以 result 表示錯誤。

### 6. RunOptions 與預設 registry

- **決策**：`RunOptions` 新增 `registry?: StepRegistry`；若未傳則使用 `createDefaultRegistry()`。呼叫端可傳入自訂 registry（完全覆寫）或先 `createDefaultRegistry()` 再註冊新 type / 覆寫既有 type。
- **替代**：強制必傳 registry 會增加使用成本；預設內建可覆寫即可兼顧簡便與擴充。

## Risks / Trade-offs

| 風險 | 緩解 |
|------|------|
| Handler 內 throw 未捕獲導致整條 run 中斷 | Executor 對每個 handler 呼叫做 try/catch，將例外轉成 StepResult(success: false, error: message) |
| 自訂 step 結構在 parse 時無法型別檢查 | 接受：驗證責任在 handler 或未來可選的 per-type schema |
| 預設 registry 與自訂 registry 行為不一致 | 內建 handler 與自訂 handler 共用同一 StepContext/StepResult 契約，文件明確寫清契約 |
| 替換時機若改為 handler 內做，易漏做或重複 | 約定由 executor 在呼叫前對 step 做 substitute，handler 收到已替換的 step |

## Migration Plan

- **Breaking change**：無相容期，直接切換。實作完成後需更新所有依賴 `@runflow/core` 的呼叫端（含 CLI）：若曾依賴 `FlowStepCommand | FlowStepJs | FlowStepHttp` 型別，改為 `FlowStep`；執行行為改為僅依 registry，未註冊 type 回傳錯誤 result。
- **Rollback**：若需回退，還原到「executor if/else + 原 FlowStep union」的 commit 即可。

### 7. CLI 載入自訂 registry

- **決策**：CLI 支援兩種方式載入自訂 handler 並與預設 registry **合併**（不替換）：(1) **設定檔**：於 cwd 或 `--config` 指定路徑尋找 `runflow.config.mjs` / `runflow.config.js`，其 `handlers` 為 `Record<type, 模組路徑>`，路徑相對 config 所在目錄，載入後以 `registerStepHandler` 合併；(2) **`--registry <path>`**：載入單一 ESM 模組的 `default`（StepRegistry），將各 type→handler 合併進目前 registry。執行順序：先依 config 建立 registry（有 config 則 default + config.handlers，否則僅 default），再依選項合併 --registry 模組。
- **範例**：`examples/custom-handler` 提供自訂 `echo` handler、`runflow.config.mjs` 與使用 `type: echo` 的 flow，供使用者參考如何透過 config 註冊並執行自訂節點。

## Open Questions

- 是否在 `StepContext` 中提供「當前 flow 的原始定義」或「當前 step 的 index」供進階 handler 使用？可留到實作或 spec 階段決定，必要時擴充 context 型別即可。
