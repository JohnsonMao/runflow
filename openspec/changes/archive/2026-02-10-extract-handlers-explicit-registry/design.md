# Design: Extract Handlers & Explicit Registry

## 1. Package 邊界

- **@runflow/core**：保留 executor、loader、parser、dag、types、stepResult、paramsSchema、substitute、constants、utils；**移除** `src/handlers/` 整目錄與 `createDefaultRegistry`。`registry.ts` 只保留 `registerStepHandler` 與 `StepRegistry` 型別（或型別留在 types），不 import 任何 handler。
- **@runflow/handlers**：新 package，`packages/handlers`。內容為現有 `core/src/handlers/*` 的搬移（含對應單元測試）。依賴僅 `@runflow/core`。

依賴方向：handlers → core；core 不依賴 handlers。

## 2. Core 變更要點

### 2.1 registry.ts

- 刪除所有 handler 的 import 以及 `createDefaultRegistry()`。
- 保留並 export `registerStepHandler(registry: StepRegistry, type: string, handler: IStepHandler): void`。
- `StepRegistry` 型別已在 `types.ts`，無需重複。

### 2.2 executor.ts

- 移除 `createDefaultRegistry` 的 import 與使用。
- `RunOptions.registry` 改為 **必填**（當 flow 有 steps 時）。若未傳 `registry` 且 flow 有 step，可選擇：  
  - 在 run() 開頭檢查並 throw 明確錯誤（建議），或  
  - 在分派 step 時若 registry 為空/undefined 則回傳 error result。  
建議採「必填 + 未傳則 throw」以利呼叫端及早發現錯誤。

### 2.3 index.ts (core)

- 移除 `createDefaultRegistry` 的 export。
- 保留 `registerStepHandler`、`run`、以及 types/stepResult/loader/parser 等既有 export。

### 2.4 Core 對 handlers 的 API 暴露

Handlers 目前使用：`types`（FlowStep, StepContext, StepResult, IStepHandler, StepResultFn, StepRegistry）、`stepResult`、`constants`（DEFAULT_ALLOWED_COMMANDS）、`utils`（isPlainObject）。  

- **types**、**stepResult**、**registerStepHandler**：已公開，不變。
- **constants**：core 的 `index.ts` 新增 export `DEFAULT_ALLOWED_COMMANDS`（與現有 `DEFAULT_MAX_FLOW_CALL_DEPTH` 一併從 constants 再 export 即可）。
- **utils**：在 core 內新增對外 export `isPlainObject`（或將 `utils.ts` 中 handlers 用到的部分 export）。建議從 `core/index.ts` 再 export 一個 `isPlainObject`，避免 handlers 重複實作。

## 3. Handlers package 設計

- **目錄**：`packages/handlers`，納入 pnpm workspace。
- **package.json**：name 為 `@runflow/handlers`，dependency 僅 `@runflow/core`；build 用 tsup，test 用 vitest，與 core 一致。
- **來源**：從 `packages/core/src/handlers/` 搬移所有 `*.ts`（含 test）至 `packages/handlers/src/`；import 路徑改為從 `@runflow/core` 取 types、stepResult、constants、isPlainObject、registerStepHandler（若 handlers 內有自建 registry 時使用）。
- **Export**：
  - 各 handler 類別（或單例）：CommandHandler, JsHandler, HttpHandler, ConditionHandler, SleepHandler, SetHandler, LoopHandler, FlowHandler。
  - 輔助函式：`createBuiltinRegistry(): StepRegistry` — 建立一個新 registry 並用 `registerStepHandler` 註冊上述所有內建 handler，回傳該 registry。如此呼叫端可 `const registry = createBuiltinRegistry()` 後傳入 `run(flow, { registry })`。
- **可選**：另 export `registerBuiltinHandlers(registry: StepRegistry): void`，讓呼叫端在已有 registry 上追加內建 handler（例如 CLI 先建空 registry 再 merge config handlers 再呼叫 registerBuiltinHandlers）。實作上可讓 `createBuiltinRegistry()` 內部呼叫 `registerBuiltinHandlers(registry)` 以減少重複。

## 4. RunOptions.registry 必填

- 型別：`RunOptions` 中 `registry: StepRegistry` 改為必要（移除 `?`）。若希望「無 step 的 flow 可不傳」，可保留 optional 但在 executor 內：當 flow 有 steps 且 `options.registry === undefined` 時 throw。
- 文件：在 README / 型別註解中說明呼叫端必須提供 registry，內建 handler 來自 `@runflow/handlers`。

## 5. CLI 與 convention-openapi

- **CLI**：  
  - 建 registry 時改為 `createBuiltinRegistry()` from `@runflow/handlers`（或等價的 registerBuiltinHandlers）。  
  - 再依既有邏輯 merge config 的 `handlers` 與 `--registry` 模組。  
  - CLI 的 dependency 加上 `@runflow/handlers`。
- **convention-openapi**：  
  - 若有呼叫 `run()` 或使用 registry（例如 integration test），改為從 `@runflow/handlers` 取得 `createBuiltinRegistry()` 並傳入 `run(flow, { registry })`。  
  - 若僅用 types、不執行 flow，則無需依賴 handlers；若有執行，則依賴 `@runflow/handlers`。

## 6. 測試

- **Core**：移除與 handlers 實作直接相關的測試（已搬至 handlers）。Executor 的測試改為使用 stub registry（只註冊測試用 step type）或於測試中 `createBuiltinRegistry()` from `@runflow/handlers`（core 以 devDependency 依賴 handlers 僅限於測試用亦可，但若希望 core 完全無依賴 handlers，則用 stub）。
- **Handlers**：所有原 core 的 handler 單元測試搬至 `packages/handlers`，並在該 package 內通過。
- **CLI / convention-openapi**：現有 e2e 或整合測試改為使用 `createBuiltinRegistry()` 建 registry 後再 run，確保通過。

## 7. 文件與範例

- **README**（root 或 core）：說明 run 時必須傳入 registry；內建 step 由 `@runflow/handlers` 提供，並示範 `createBuiltinRegistry()` 或 `registerBuiltinHandlers(registry)` 的用法。
- **examples/custom-handler**：若目前依賴「預設已含內建」的 registry，改為在範例中先 `createBuiltinRegistry()` 再註冊自訂 handler，然後 run；README 更新為上述流程。

## 8. 小結

| 項目 | 決策 |
|------|------|
| registry 來源 | 僅由呼叫端提供；core 不提供 createDefaultRegistry |
| RunOptions.registry | 必填（或無 step 時可選，有 step 未傳則 throw） |
| 內建 handler 取得 | 從 @runflow/handlers 的 createBuiltinRegistry() 或 registerBuiltinHandlers(registry) |
| core 額外 export | DEFAULT_ALLOWED_COMMANDS、isPlainObject（或等同 utility） |
| Core 內 registry.ts | 只保留 registerStepHandler，不 import handlers |
