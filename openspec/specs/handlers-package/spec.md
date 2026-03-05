# handlers-package Specification

## Purpose

定義內建 step 實作所屬的獨立 package：`@runflow/handlers` 提供所有內建 step 的 handler 實作，僅依賴 `@runflow/core`；core 不依賴此 package。呼叫端若需內建 step，須依賴本 package 並主動註冊至 registry。

## Requirements

### Requirement: Package SHALL be named and depend only on core

The built-in handlers package `@runflow/handlers` SHALL NOT depend on `@runflow/core` in its production `dependencies`. It SHALL include core in `devDependencies` for type support in tests, but it MUST NOT import any code from `@runflow/core` in its handler implementations. All necessary types and tools MUST be provided via the factory context injected by the engine at runtime.

#### Scenario: No runtime dependency on core
- **WHEN** the `package.json` for `@runflow/handlers` is inspected
- **THEN** `@runflow/core` SHALL NOT be listed in the `dependencies` section
- **AND** the handler source code SHALL NOT contain `import` statements from `@runflow/core`


<!-- @trace
source: standardize-handler-factory
updated: 2026-03-05
code:
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/openapi/simple.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - packages/handlers/src/set.ts
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/tt/test.yaml
  - workspace/config/auth.json
  - packages/workspace/src/config.ts
  - packages/core/src/validateCanBeDependedOn.ts
  - packages/handlers/src/message.ts
  - workspace/config/runflow.config.json
  - packages/handlers/src/condition.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/tt/post-users.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - packages/handlers/src/loop.ts
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - packages/handlers/src/index.ts
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/openapi/admin-order.yaml
  - workspace/openapi/admin-payments.yaml
  - packages/core/src/handler-factory.ts
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - packages/handlers/package.json
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - apps/cli/src/cli.ts
  - packages/core/src/engine.ts
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/src/payments.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - packages/core/src/utils.ts
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - packages/core/src/handler-adapter.ts
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/openapi/admin-promotion.yaml
  - packages/handlers/src/flow.ts
  - packages/core/src/types.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - workspace/flows/tt/get-users.yaml
  - workspace/custom-handler/test.mjs
  - workspace/openapi/admin-location-point.yaml
  - packages/core/src/index.ts
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - packages/handlers/src/sleep.ts
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/src/scm.ts
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/openapi/admin-location-member.yaml
  - apps/mcp-server/src/index.ts
  - packages/handlers/src/http.ts
  - packages/handlers/src/test-helpers.ts
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/tt/params-count2.json
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
tests:
  - packages/convention-openapi/src/integration.test.ts
  - apps/cli/src/cli.run.test.ts
  - apps/mcp-server/src/index.test.ts
  - packages/handlers/src/sleep.test.ts
  - packages/workspace/src/config.test.ts
  - packages/core/src/validateCanBeDependedOn.test.ts
  - packages/handlers/src/http.test.ts
  - packages/core/src/engine.test.ts
  - packages/handlers/src/loop.test.ts
  - packages/core/src/run.test.ts
  - packages/core/src/handler-factory.test.ts
  - packages/handlers/src/message.test.ts
  - packages/handlers/src/flow.test.ts
  - packages/handlers/src/condition.test.ts
  - packages/handlers/src/set.test.ts
-->

---
### Requirement: Handlers SHALL implement IStepHandler from core

Each built-in step type SHALL be implemented as a `HandlerFactory` function. These factories SHALL use only the tools injected via the factory context (`defineHandler`, `z`, `utils`, etc.). The `IStepHandler` class-based interface is REMOVED, and built-in handlers MUST NOT inherit from any base class or implement any interface from `@runflow/core` at runtime.

#### Scenario: Http handler implementation as factory
- **WHEN** the `http` handler is inspected
- **THEN** it SHALL be a factory function exporting a configuration with `type: 'http'`, `schema`, and `run`
- **AND** it SHALL NOT depend on any class or interface from `@runflow/core`


<!-- @trace
source: standardize-handler-factory
updated: 2026-03-05
code:
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/openapi/simple.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - packages/handlers/src/set.ts
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/tt/test.yaml
  - workspace/config/auth.json
  - packages/workspace/src/config.ts
  - packages/core/src/validateCanBeDependedOn.ts
  - packages/handlers/src/message.ts
  - workspace/config/runflow.config.json
  - packages/handlers/src/condition.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/tt/post-users.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - packages/handlers/src/loop.ts
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - packages/handlers/src/index.ts
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/openapi/admin-order.yaml
  - workspace/openapi/admin-payments.yaml
  - packages/core/src/handler-factory.ts
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - packages/handlers/package.json
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - apps/cli/src/cli.ts
  - packages/core/src/engine.ts
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/src/payments.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - packages/core/src/utils.ts
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - packages/core/src/handler-adapter.ts
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/openapi/admin-promotion.yaml
  - packages/handlers/src/flow.ts
  - packages/core/src/types.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - workspace/flows/tt/get-users.yaml
  - workspace/custom-handler/test.mjs
  - workspace/openapi/admin-location-point.yaml
  - packages/core/src/index.ts
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - packages/handlers/src/sleep.ts
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/src/scm.ts
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/openapi/admin-location-member.yaml
  - apps/mcp-server/src/index.ts
  - packages/handlers/src/http.ts
  - packages/handlers/src/test-helpers.ts
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/tt/params-count2.json
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
tests:
  - packages/convention-openapi/src/integration.test.ts
  - apps/cli/src/cli.run.test.ts
  - apps/mcp-server/src/index.test.ts
  - packages/handlers/src/sleep.test.ts
  - packages/workspace/src/config.test.ts
  - packages/core/src/validateCanBeDependedOn.test.ts
  - packages/handlers/src/http.test.ts
  - packages/core/src/engine.test.ts
  - packages/handlers/src/loop.test.ts
  - packages/core/src/run.test.ts
  - packages/core/src/handler-factory.test.ts
  - packages/handlers/src/message.test.ts
  - packages/handlers/src/flow.test.ts
  - packages/handlers/src/condition.test.ts
  - packages/handlers/src/set.test.ts
-->

---
### Requirement: Package SHALL export all built-in handler classes and a registration helper

The package SHALL export a `builtinHandlers` constant that is an array of all built-in `HandlerFactory` functions. It SHALL NO LONGER export class constructors or the `createBuiltinRegistry` helper (logic moved to core's `buildRegistry`). This array SHALL be used by callers to build a registry.

#### Scenario: Getting all built-ins as an array
- **WHEN** a caller imports `builtinHandlers` from `@runflow/handlers`
- **THEN** it SHALL receive an array of factory functions for `http`, `condition`, `sleep`, `set`, `loop`, `flow`
- **AND** the caller SHALL be able to use `buildRegistry(builtinHandlers.map(f => f(context)))` to initialize a registry


<!-- @trace
source: standardize-handler-factory
updated: 2026-03-05
code:
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/openapi/simple.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - packages/handlers/src/set.ts
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/tt/test.yaml
  - workspace/config/auth.json
  - packages/workspace/src/config.ts
  - packages/core/src/validateCanBeDependedOn.ts
  - packages/handlers/src/message.ts
  - workspace/config/runflow.config.json
  - packages/handlers/src/condition.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/tt/post-users.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - packages/handlers/src/loop.ts
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - packages/handlers/src/index.ts
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/openapi/admin-order.yaml
  - workspace/openapi/admin-payments.yaml
  - packages/core/src/handler-factory.ts
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - packages/handlers/package.json
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - apps/cli/src/cli.ts
  - packages/core/src/engine.ts
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/src/payments.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - packages/core/src/utils.ts
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - packages/core/src/handler-adapter.ts
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/openapi/admin-promotion.yaml
  - packages/handlers/src/flow.ts
  - packages/core/src/types.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - workspace/flows/tt/get-users.yaml
  - workspace/custom-handler/test.mjs
  - workspace/openapi/admin-location-point.yaml
  - packages/core/src/index.ts
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - packages/handlers/src/sleep.ts
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/src/scm.ts
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/openapi/admin-location-member.yaml
  - apps/mcp-server/src/index.ts
  - packages/handlers/src/http.ts
  - packages/handlers/src/test-helpers.ts
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/tt/params-count2.json
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
tests:
  - packages/convention-openapi/src/integration.test.ts
  - apps/cli/src/cli.run.test.ts
  - apps/mcp-server/src/index.test.ts
  - packages/handlers/src/sleep.test.ts
  - packages/workspace/src/config.test.ts
  - packages/core/src/validateCanBeDependedOn.test.ts
  - packages/handlers/src/http.test.ts
  - packages/core/src/engine.test.ts
  - packages/handlers/src/loop.test.ts
  - packages/core/src/run.test.ts
  - packages/core/src/handler-factory.test.ts
  - packages/handlers/src/message.test.ts
  - packages/handlers/src/flow.test.ts
  - packages/handlers/src/condition.test.ts
  - packages/handlers/src/set.test.ts
-->

---
### Requirement: Core SHALL export what handlers need

`@runflow/core` SHALL provide a set of tools to be injected into handler factories: `z` (Zod), `defineHandler` (factory helper), and a `utils` object (chainable string/data helpers). Core SHALL NOT require handlers to import these tools explicitly. Core SHALL also export the necessary types (`FlowStep`, `StepContext`, `StepResult`, `StepRegistry`, etc.) for IDE support, but these SHALL NOT be required for runtime execution of handlers.

#### Scenario: Handlers import from core only
- **WHEN** `@runflow/handlers` is built
- **THEN** its source files contain no `import` from `@runflow/core` in the factory implementation
- **AND** all required tools are provided via the factory context at runtime


<!-- @trace
source: refactor-handler-factory-pattern
updated: 2026-03-04
code:
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/custom-handler/test.mjs
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/config/runflow.config.json
  - workspace/openapi/admin-payments.yaml
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - packages/core/src/engine.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/openapi/admin-delivery.yaml
  - packages/core/src/index.ts
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/src/scm.ts
  - workspace/openapi/admin-location.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - workspace/openapi/admin-order.yaml
  - workspace/flows/tt/post-users.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - packages/handlers/src/sleep.ts
  - workspace/flows/tt/test.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - packages/core/src/handler-factory.ts
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - packages/handlers/src/loopClosure.ts
  - workspace/openapi/admin-salepage.yaml
  - workspace/config/auth.json
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - packages/core/src/handler-adapter.ts
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - packages/core/src/types.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - packages/handlers/src/flow.ts
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/flows/tt/get-users.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/openapi/simple.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - packages/workspace/package.json
  - workspace/flows/tt/example-loop-two-branches.yaml
  - packages/handlers/src/condition.ts
  - packages/handlers/src/set.ts
  - packages/workspace/src/config.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/openapi/admin-promotion.yaml
  - packages/handlers/src/http.ts
  - workspace/src/payments.ts
  - packages/handlers/src/index.ts
  - workspace/openapi/admin-location-member.yaml
  - workspace/flows/payment/payments-transaction-query.yaml
  - packages/handlers/src/loop.ts
  - workspace/flows/tt/params-count2.json
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
tests:
  - packages/handlers/src/condition.test.ts
  - packages/handlers/src/loop.test.ts
  - packages/handlers/src/loopClosure.test.ts
  - packages/handlers/src/flow.test.ts
  - packages/handlers/src/sleep.test.ts
  - packages/handlers/src/set.test.ts
  - apps/cli/src/cli.run.test.ts
  - packages/handlers/src/http.test.ts
-->

---
### Requirement: Tests for handlers SHALL live in the handlers package

Unit tests for each built-in handler (http, condition, sleep, set, loop, flow) SHALL be moved with the handler implementations into `@runflow/handlers` and SHALL pass there. Core's test suite SHALL NOT contain handler implementation details; those SHALL live in the handlers package.

#### Scenario: Handlers package tests pass in isolation

- **WHEN** `pnpm --filter @runflow/handlers test` is run
- **THEN** all handler unit tests pass
- **AND** no test file in core contains handler implementation details (those live in handlers)