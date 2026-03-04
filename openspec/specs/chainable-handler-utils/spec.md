# chainable-handler-utils Specification

## Purpose

TBD - created by archiving change 'refactor-handler-factory-pattern'. Update Purpose after archive.

## Requirements

### Requirement: utils SHALL provide chainable string processing

The `utils` object SHALL provide a `str(input: string)` method that returns a chainable wrapper for string operations. This wrapper SHALL include at least: `.substitute(params: Record<string, unknown>)` for template replacement and `.lowercase()` for case transformation. It SHALL have a `.value()` method to retrieve the final string.

#### Scenario: Chainable string substitution and transformation
- **WHEN** a handler calls `utils.str('{{ base }}/API').substitute({ base: 'HTTP' }).lowercase().value()`
- **THEN** the result SHALL be `"http/api"`
- **AND** the handler SHALL NOT require manual `substitute` calls from `@runflow/core`


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
### Requirement: utils SHALL provide chainable data manipulation

The `utils` object SHALL provide a `data(input: any)` method that returns a chainable wrapper for data object manipulation. This wrapper SHALL include at least: `.pick(keys: string[])` for picking properties and `.merge(other: object)` for merging objects. It SHALL have a `.toJSON()` method to return a JSON string and a `.value()` method for the final object.

#### Scenario: Chainable data picking and merging
- **WHEN** a handler calls `utils.data({ a: 1, b: 2 }).pick(['a']).merge({ c: 3 }).value()`
- **THEN** the result SHALL be `{ a: 1, c: 3 }`
- **AND** the original object SHALL NOT be modified


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
### Requirement: utils SHALL provide optional chainable HTTP client

The `utils` object SHALL provide a simplified, chainable HTTP client (e.g., `utils.http.get(url).json().send()`). This client SHALL automatically integrate with the injected `AbortSignal` if provided by the engine.

#### Scenario: Chainable HTTP request
- **WHEN** a handler calls `await utils.http.post(url).json({ id: 1 }).send()`
- **THEN** it SHALL perform a POST request with the given JSON body
- **AND** the request SHALL be automatically aborted on step timeout via the injected `signal`


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
### Requirement: Chainable utils SHALL be discoverable via IDE autocomplete

The `utils` object and its chainable methods SHALL be defined such that IDEs (e.g., VS Code) can provide full IntelliSense when used within the injected factory function. This MUST be achieved via ambient type declarations (e.g., `.d.ts` files) without requiring the user to `import` types explicitly.

#### Scenario: Developer receives autocomplete for chainable utils
- **WHEN** a developer types `utils.str('...').`
- **THEN** the IDE SHALL suggest `substitute`, `lowercase`, `value`, etc.
- **AND** no `import` or `/// <reference />` SHALL be required if the workspace is correctly configured

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