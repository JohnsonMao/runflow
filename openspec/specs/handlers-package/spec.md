# handlers-package Specification

## Purpose

定義內建 step 實作所屬的獨立 package：`@runflow/handlers` 提供所有內建 step 的 handler 實作，僅依賴 `@runflow/core`；core 不依賴此 package。呼叫端若需內建 step，須依賴本 package 並主動註冊至 registry。

## Requirements

### Requirement: Package SHALL be named and depend only on core

The built-in handlers SHALL live in a package named `@runflow/handlers`. This package SHALL have a single dependency: `@runflow/core`. It SHALL NOT depend on any other workspace package. The core package SHALL NOT depend on `@runflow/handlers`.

#### Scenario: No circular dependency

- **WHEN** dependency graph is inspected
- **THEN** `@runflow/handlers` → `@runflow/core` only
- **AND** `@runflow/core` has no dependency on `@runflow/handlers`

---
### Requirement: Handlers SHALL implement IStepHandler from core

Each built-in step type SHALL be implemented as a factory function that returns a configuration object conforming to the new Handler Factory pattern (run, optional schema, optional flowControl). Handlers SHALL NO LONGER be implemented as classes. They SHALL use only tools and types injected via the factory context (`z`, `defineHandler`, `utils`, `params`, `signal`).

#### Scenario: Http handler runs via registry
- **WHEN** a caller creates an empty registry, registers `HttpHandler` factory from `@runflow/handlers` for type `'http'`, and runs a flow with an http step
- **THEN** the executor dispatches to that factory's `run` function and the step runs as today
- **AND** behavior is unchanged from the current class-based http handler


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
### Requirement: Package SHALL export all built-in handler classes and a registration helper

The package SHALL export individual handler classes (or instances): `HttpHandler`, `ConditionHandler`, `SleepHandler`, `SetHandler`, `LoopHandler`, `FlowHandler`. (Command and Js handlers are no longer built-in.) The package SHALL also export a helper that registers all built-in handlers into a given registry (e.g. `createBuiltinRegistry(): StepRegistry`). The engine (core) SHALL NOT call this helper; only callers (CLI, tests, etc.) SHALL use it.

#### Scenario: Caller gets full set of built-ins with one call

- **WHEN** a caller does `const registry = createBuiltinRegistry()` from `@runflow/handlers`, then passes `registry` to `run(flow, { registry })`
- **THEN** flows using any built-in step type (http, condition, sleep, set, loop, flow) run correctly
- **AND** the registry is built by the caller using the handlers package, not provided by core

#### Scenario: Caller registers only some built-in types

- **WHEN** a caller creates an empty registry and registers only `HttpHandler` and `SetHandler` from `@runflow/handlers`
- **THEN** only steps with `type: 'http'` or `type: 'set'` are executed by those handlers
- **AND** steps with other unregistered types produce an error result per engine behavior

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