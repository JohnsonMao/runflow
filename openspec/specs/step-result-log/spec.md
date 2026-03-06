# step-result-log

## Purpose

StepResult 具備可選的 **log** 欄位，用於顯示每步的簡短摘要；自 StepResult 移除 **stdout**、**stderr**，統一以 log 作為對外顯示來源。CLI 預設顯示帶有顏色的執行總結報告。

## Requirements

### Requirement: Step logs for execution flow
Steps SHALL return a `log` string as part of their result to provide execution context to the user.

#### Scenario: Success with log
- **WHEN** a step completes successfully and provides a non-empty `log`
- **THEN** the system SHALL capture the log for display in the default run summary

#### Scenario: Success without log
- **WHEN** a step completes successfully but provides an empty or null `log`
- **THEN** the system SHALL NOT display this step in the default run summary to reduce noise


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

---
### Requirement: StepResult SHALL have optional log and SHALL NOT have stdout/stderr

- StepResult SHALL include an optional `log?: string` field. Handlers MAY set it via `context.stepResult(stepId, success, { log: '...' })` to provide a one-line summary for display.
- StepResult SHALL NOT include `stdout` or `stderr` fields. Display of step output SHALL use `log` when present.

#### Scenario: Step with log

- **WHEN** a handler returns `stepResult(step.id, true, { log: 'GET https://example.com → 200' })`
- **THEN** the StepResult has `log` set to that string
- **AND** display SHALL show that string as the step's display line (e.g. `- ✓ Step Name — GET https://example.com → 200`)

#### Scenario: Step without log

- **WHEN** a handler returns stepResult without `log`
- **THEN** the StepResult may omit `log` or have it undefined
- **AND** the step SHALL be hidden from the default run summary if success is true.

---
### Requirement: CLI SHALL output run summary by default

- The CLI `run` command SHALL output a formatted summary of the execution using `formatRunResult`.
- It SHALL NOT require a `--verbose` flag to see step logs.

#### Scenario: Running a flow
- **WHEN** the CLI finishes executing a flow
- **THEN** it SHALL print a summary of all failed steps and all successful steps that have logs
- **AND** it SHALL NOT print raw output JSON objects by default (use `inspect` instead)
