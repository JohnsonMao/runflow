## Why

目前的 `IStepHandler` 類別開發模式強迫開發者引入 `@runflow/core` 的型別，且在自訂 handler 時需要複雜的打包流程。這導致開發體驗 (DX) 不佳、除錯困難，且內建與自訂 handler 的實作風格不一致。

## What Changes

- **開發模式轉型**：從 Class-based 轉為 Zero-import Function-based Factory 模式 (`export default ({ defineHandler }) => ...`)。
- **工具注入 (Injection)**：引擎在載入 handler 時注入 `z` (Zod)、`defineHandler`、`utils` 等工具，開發者無需手動 import。
- **靈活回報機制**：Handler 可透過 `context.report()` 即時回報結果（支援多次/串流），或維持 `return` 物件方式。
- **統一介面**：所有內建 handler (http, loop, condition 等) 全部改用 Factory 模式重構。
- **鏈式工具庫**：提供具備鏈式調用能力的 `utils` (如 `utils.str`, `utils.data`) 以簡化資料處理邏輯。
- **動態載入**：CLI/Engine 支援直接載入 `.ts` handler 檔案，無需預先打包。

## Capabilities

### New Capabilities

- `handler-factory-pattern`: 定義新的 Handler Factory 規範、注入機制與回傳格式。
- `chainable-handler-utils`: 定義注入給 handler 的鏈式工具庫功能與介面。

### Modified Capabilities

- `handlers-package`: 修改內建 handler 的實作規範，從 Class 改為 Factory 模式。
- `custom-node-registry`: 修改自訂 handler 的載入與註冊機制，支援直接載入 TS Factory 檔案。
- `step-context`: 更新注入給 handler 的 context 內容與 `StepResult` 的產生方式。

## Impact

- **Affected code**: `packages/core` (loader, engine, types), `packages/handlers` (all handlers), `apps/cli` (handler loading), `packages/workspace` (config resolution).
- **Breaking Change**: 自訂 handler 的介面將不相容，需遷移至新的 Factory 模式。
