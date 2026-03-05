# handler-factory-pattern Specification

## Purpose

TBD - created by archiving change 'refactor-handler-factory-pattern'. Update Purpose after archive.

## Requirements

### Requirement: Handlers SHALL be defined via a Factory function

The system SHALL support defining step handlers as a default export of a factory function. This function SHALL receive a context object containing tools (`defineHandler`, `z`, `utils`, etc.) and MUST return a handler configuration using `defineHandler`. The `defineHandler` call MUST include a `type` property (string) that uniquely identifies the step type handled by this handler. The canonical pattern SHALL be: `export default ({ defineHandler }) => defineHandler({ type: 'name', ... })`.

#### Scenario: Basic handler factory definition with type
- **WHEN** a handler file contains `export default ({ defineHandler }) => defineHandler({ type: 'echo', ... })`
- **THEN** the engine SHALL invoke this factory with the required tools
- **AND** the resulting handler configuration SHALL include `type: 'echo'`
- **AND** the handler SHALL be eligible for automatic registration in the step registry via its `type`


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
### Requirement: defineHandler SHALL support Zod schema for step validation

The `defineHandler` tool SHALL accept an optional `schema` property using Zod. When present, the engine SHALL use this schema to validate the step configuration before execution. The `run` function's `step` parameter SHALL automatically infer types from this schema if provided.

#### Scenario: Handler with schema validation
- **WHEN** a handler defines `schema: z.object({ url: z.string().url() })`
- **THEN** the engine SHALL validate the step's `url` property before running
- **AND** if validation fails, the engine SHALL return a `StepResult` with `success: false` and the Zod error message


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
### Requirement: Handlers SHALL report results via context or return

The handler's `run` function SHALL receive a `context` object (of type `HandlerContext`) with a `report(result: SimpleResult)` method. Handlers MAY call `context.report()` multiple times to emit intermediate results or logs. Handlers MAY also return a `SimpleResult` object (or `void`) from the `run` function. The engine SHALL aggregate these reports. If `run` returns a result, it SHALL be treated as the final report.

**Note**: The `HandlerContext` does NOT include `utils`. Handlers SHALL access `utils` from the `FactoryContext` closure (captured when the factory function is invoked).

#### Scenario: Handler reports results via context
- **WHEN** a handler calls `context.report({ log: 'processing...' })` then `context.report({ success: true, outputs: { val: 1 } })`
- **THEN** the engine SHALL capture both reports
- **AND** the final `StepResult` SHALL reflect the accumulated state (success: true, outputs: { val: 1 })


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
### Requirement: Engine SHALL inject AbortSignal for lifecycle management

The context passed to the handler's `run` function SHALL include a `signal: AbortSignal`. The engine SHALL trigger this signal on step timeout or when the run is aborted. Handlers SHALL use this signal for asynchronous operations (e.g., `fetch`, child processes).

#### Scenario: Handler uses injected AbortSignal
- **WHEN** a handler performs a `fetch(url, { signal })`
- **THEN** the request SHALL be aborted if the engine triggers the signal
- **AND** the handler SHALL NOT need to manually manage `AbortController` or `kill()` method


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
### Requirement: Factory context SHALL provide utility tools

The factory function SHALL receive a `utils` object containing common helpers (e.g., `isPlainObject`). This ensures handlers can perform common tasks without importing external utility libraries.

#### Scenario: Handler uses injected utils
- **WHEN** a handler calls `utils.isPlainObject(step.data)`
- **THEN** it SHALL correctly identify if the value is a plain object
- **AND** no `import` statement for utility functions SHALL be required in the handler file

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
### Requirement: HandlerFactory SHALL be testable without full engine integration

The system SHALL export a `createFactoryContext()` helper from `@runflow/core` (or a dedicated testing utility). Developers SHALL use this helper to create a mock context to invoke the factory function in unit tests. This allows testing the `schema` validation and `run` logic of a handler in isolation from the full flow execution engine.

#### Scenario: Unit testing a handler factory
- **WHEN** a test calls a handler factory with `createFactoryContext()`
- **THEN** it SHALL receive the handler configuration object
- **AND** the test SHALL be able to invoke `handler.run(context)` directly with mock parameters
- **AND** the test SHALL NOT require a running flow engine or a workspace configuration

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