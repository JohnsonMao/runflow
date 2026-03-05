## Why

目前 `@runflow` 正處於從 `IStepHandler` (Class-based) 遷移到 `HandlerFactory` (Function-based) 的過渡期。雖然已經引入了 Factory 模式，但程式碼中仍保留了大量舊有的 `IStepHandler` 介面與負責相容性的 `HandlerAdapter`，且 `handlers` 套件仍依賴於 `core`。為了達成真正的「零依賴」開發體驗、簡化 handler 註冊流程並提升系統純粹性，我們需要徹底移除舊架構。

## What Changes

- **移除舊架構**: 徹底刪除 `IStepHandler` 介面定義以及 `@packages/core/src/handler-adapter.ts`。
- **全面 Factory 化**: 所有的內建與自訂 handler 必須使用 `HandlerFactory` 模式實作。
- **內置類型宣告 (BREAKING)**: Factory 函數在定義 handler 時，需直接包含其 `type` 名稱（例如 'http', 'loop'），不再由註冊時決定 Key。
- **陣列式註冊 (BREAKING)**: `workspace` 的 Registry 註冊方式從物件 `{ [type]: handler }` 改為接受一個 Handler 陣列 `Handler[]`，簡化註冊邏輯。
- **零依賴 Handlers (BREAKING)**: `@runflow/handlers` 套件將不再依賴 `@runflow/core`，達成完全解耦。
- **強化測試**: 為 `HandlerFactory` 機制補齊完整的單元測試。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `handler-factory-pattern`: 更新規範以支援內置 type 名稱與對應的 `defineHandler` 簽署。
- `custom-node-registry`: 修改註冊機制，從物件 Key-Value 對應改為陣列式自動註冊。
- `handlers-package`: 移除對 `@runflow/core` 的依賴，改為純 Factory 實作。
- `workspace`: 更新配置解析邏輯，支援從 `config.handlers` 載入並整合陣列格式的 Registry。

## Impact

- **Affected code**: `packages/core` (types, engine, factory), `packages/handlers` (all handlers & package.json), `packages/workspace` (config loading), `apps/cli`, `apps/mcp-server`.
- **Breaking Change**: 所有自訂 handler 的註冊方式與 Factory 定義簽署將發生變化，需進行遷移。
