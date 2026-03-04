## 1. Core Framework Refactor (Factory & Injection)

- [x] 1.1 In `packages/core`, implement `defineHandler` factory helper to enable "採用 Zero-Import Factory 模式" and ensure "Handlers SHALL be defined via a Factory function" using `export default ({ defineHandler })`.
- [x] 1.2 Update `packages/core` types to include `HandlerContext` with `params` and "Engine SHALL inject AbortSignal for lifecycle management". Note: `utils` is provided via `FactoryContext` closure, not in `HandlerContext`.
- [x] 1.3 Modify `packages/core` to ensure "defineHandler SHALL support Zod schema for step validation" and "整合 Zod 進行宣告式驗證".
- [x] 1.4 Refactor `packages/core` engine to support "Handlers SHALL report results via context or return" and ensure "StepResult contract SHALL be unchanged, but delivered via context".
- [x] 1.5 Update `StepContext` to ensure "StepContext SHALL provide params, previous outputs, and flowFilePath", plus `report(result)`, and "StepContext provides run (RunFlowFn) for nested flows; no pushMarkerStep".
- [x] 1.6 Ensure "Context SHALL accumulate with step outputs namespaced by effective output key" and "StepResult SHALL support outputs" in the updated engine.
- [x] 1.7 Ensure "JS steps SHALL receive params and MAY return outputs" still works with the refactored context.
- [x] 1.8 Update engine to ensure "context.run (RunFlowFn); handler SHALL validate body step ids when building sub-flow".

## 2. Chainable Utilities Implementation

- [x] 2.1 Implement `utils.str()` in `packages/core` to ensure "utils SHALL provide chainable string processing" and "提供鏈式 工具庫 (Chainable Utils)".
- [x] 2.2 Implement `utils.data()` in `packages/core` to ensure "utils SHALL provide chainable data manipulation".
- [x] 2.3 Implement `utils.http` in `packages/core` to ensure "utils SHALL provide optional chainable HTTP client".
- [x] 2.4 Ensure "Factory context SHALL provide utility tools" including `isPlainObject` and chainable helpers.

## 3. Handlers Package Refactor

- [x] 3.1 Refactor `packages/handlers/src/http.ts` to use the new Factory pattern and ensure "Handlers SHALL implement IStepHandler from core".
- [x] 3.2 Refactor `packages/handlers/src/loop.ts` to use the new Factory pattern and validate body step ids.
- [x] 3.3 Refactor `packages/handlers/src/condition.ts` to use the new Factory pattern.
- [x] 3.4 Refactor `packages/handlers/src/set.ts`, `sleep.ts`, and `flow.ts` to the new Factory pattern.
- [x] 3.5 Update `packages/handlers/src/index.ts` to ensure "Package SHALL export all built-in handler factories and a registration helper" as default exports.
- [x] 3.6 Update `packages/core` exports to ensure "Core SHALL export what handlers need" for internal and external use.

## 4. Loader & CLI Integration

- [x] 4.1 Update `packages/workspace` and `apps/cli` to "使用 jiti/tsx 實現動態載入" and ensure "CLI SHALL build registry using @runflow/handlers plus config and --registry".
- [x] 4.2 Ensure the loader supports direct loading of `.ts` handler files and correctly initializes the factory.
- [x] 4.3 Update `StepHandler interface SHALL be the single execution contract` implementation in the engine to use the new factory-produced configs.

## 5. Validation & Documentation

- [x] 5.1 Update unit tests in `packages/core` and `packages/handlers` to verify the new Factory pattern.
- [x] 5.2 Create a sample custom handler in `workspace/custom-handler/` to verify "零 import" and dynamic loading.
- [x] 5.3 Verify validation logic with Zod schemas in various handlers.
- [x] 5.4 Update README and migration guide to reflect the new handler development model.
