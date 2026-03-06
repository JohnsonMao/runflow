# sleep-step Specification

## Purpose

Step type `sleep`: delays execution for a configurable duration (seconds or milliseconds). Supports template substitution for the duration value. Produces no outputs; step succeeds after the delay.

## Requirements

### Requirement: Flows MUST support steps with type `sleep`

A flow step MUST be allowed to have `type: 'sleep'`. The engine MUST execute this step via the registered handler for `sleep`. The handler MUST wait for the specified duration then return a StepResult with `success: true` and no outputs. Parser SHALL accept any step with `id` and `type: 'sleep'` and optional duration fields as a generic step.

#### Scenario: Sleep with seconds

- **WHEN** a flow contains a step `{ id: 'wait', type: 'sleep', seconds: 1, dependsOn: [] }` and the default registry includes the sleep handler
- **THEN** the executor invokes the sleep handler; the handler waits 1 second and returns StepResult with success: true, no outputs
- **AND** the step is marked completed so dependents may run

#### Scenario: Sleep with ms

- **WHEN** a step has `type: 'sleep'` and `ms: 500` (and no seconds)
- **THEN** the handler SHALL wait 500 milliseconds and return success with no outputs

#### Scenario: Duration from context (template substitution)

- **WHEN** context has `delay: 2` and the sleep step has `seconds: "{{ delay }}"` (or equivalent after substitution)
- **THEN** the executor passes the step with substituted values; the handler SHALL wait the resolved duration (e.g. 2 seconds)
- **AND** the step completes successfully with no outputs

---
### Requirement: Sleep step SHALL require a duration

The sleep handler SHALL require either `seconds` (number) or `ms` (number) after substitution. If both are present, implementation MAY prefer one (e.g. seconds over ms). If neither is present or value is invalid, the handler SHALL return a StepResult with `success: false` and an error message.

#### Scenario: Missing duration

- **WHEN** a sleep step has no `seconds` and no `ms` (or both resolve to invalid values)
- **THEN** the handler returns StepResult with success: false and error describing the missing or invalid duration

---
### Requirement: Execution logging
The sleep handler SHALL NOT provide a default log entry when completing successfully to reduce execution noise.

#### Scenario: Silent sleep
- **WHEN** a sleep step completes successfully
- **THEN** the step result SHALL contain an empty log property

<!-- @trace
source: simplify-execution-logs
updated: 2026-03-06
code:
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/custom-handler/logistics-center-handler.mjs
  - workspace/src/logisticsCenter.ts
  - workspace/flows/order/batch-order-confirm.yaml
  - packages/workspace/src/format.ts
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/openapi/admin-order.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - packages/handlers/src/sleep.ts
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/tt/params-count2.json
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - workspace/openapi/admin-invoice.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/openapi/admin-payments.yaml
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/src/promotionRules.ts
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - packages/core/src/types.ts
  - workspace/openapi/admin-location-member.yaml
  - workspace/config/runflow.config.json
  - workspace/flows/tt2/sub.yaml
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/config/auth.json
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/src/scm.ts
  - workspace/flows/tt/post-users.yaml
  - workspace/flows/tt/get-users.yaml
  - packages/core/src/engine.ts
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - workspace/custom-handler/log-helper.mjs
  - workspace/custom-handler/txn-token-handler.mjs
  - workspace/flows/tt/test.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - packages/handlers/src/http.ts
  - workspace/openapi/admin-location.yaml
  - workspace/src/payments.ts
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
tests:
  - packages/handlers/src/sleep.test.ts
  - packages/workspace/src/format.test.ts
  - apps/mcp-server/src/tools.test.ts
  - packages/handlers/src/http.test.ts
-->