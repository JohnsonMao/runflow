## 1. 核心架構重構 (Core Refactoring)

- [x] 1.1 移除 IStepHandler 與 HandlerAdapter：徹底刪除 `packages/core` 中的 `IStepHandler` 介面與 `handler-adapter.ts` 文件，確保 Handlers SHALL implement IStepHandler from core 改為 Factory 模式。
- [x] 1.2 Factory 內置類型宣告：更新 `handler-factory.ts`，確保 `defineHandler` 要求實作 StepHandler interface SHALL be the single execution contract 並包含 Factory 內置類型宣告。
- [x] 1.3 採用陣列式註冊機制：在 `packages/core` 中實作 `buildRegistry` 函數，確保 Engine SHALL NOT provide a default registry; registry SHALL be required when flow has steps。
- [x] 1.4 為 HandlerFactory 增加單元測試：在 `packages/core` 中增加測試，驗證 HandlerFactory SHALL be testable without full engine integration。

## 2. 內建 Handler 更新 (Handlers Package Update)

- [x] 2.1 徹底解耦 packages/handlers 與 packages/core：修改 `packages/handlers/package.json`，確保 Package SHALL be named and depend only on core 改為不再於執行時依賴 core。
- [x] 2.2 更新內建 Handler 實作：將所有內建 handler 修改為 Handlers SHALL be implemented as Factories without inheritance。
- [x] 2.3 導出 Factory 陣列：在 `packages/handlers` 中確保 Package SHALL export all built-in handler classes and a registration helper 並導出 builtinHandlers 陣列。
- [x] 2.4 驗證 Handlers SHALL be defined via a Factory function：更新內建 handler 確保它們在 defineHandler 中正確宣告內置類型。

## 3. 工作區與配置更新 (Workspace & Config Update)

- [x] 3.1 支援陣列式處理程序配置：更新 `packages/workspace` 確保 Workspace SHALL provide config discovery and loading 並支援陣列格式。
- [x] 3.2 更新工作區 Registry 構建器：確保 Workspace SHALL provide createResolveFlow for core 並整合 builtinHandlers 於 buildRegistryFromConfig。
- [x] 3.3 CLI 註冊機制更新：驗證 CLI SHALL build registry using @runflow/handlers plus config and --registry 並支援陣列格式。
