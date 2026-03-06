# api-logging-security Specification

## Purpose

TBD - created by archiving change 'engine-early-termination-and-api-logging-enhancement'. Update Purpose after archive.

## Requirements

### Requirement: http handler SHALL log response summary
When executing an `http` step, the handler SHALL include a summary in the `log` field of the StepResult. This summary SHALL contain the HTTP method, URL, and status code (e.g., `GET http://example.com -> 200`).

#### Scenario: Successful request log
- **WHEN** a GET request to http://example.com returns 200
- **THEN** the step log SHALL include `GET http://example.com -> 200`


<!-- @trace
source: engine-early-termination-and-api-logging-enhancement
updated: 2026-03-06
code:
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/openapi/admin-payments.yaml
  - workspace/custom-handler/log-helper.mjs
  - packages/core/src/engine.ts
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - workspace/config/auth.json
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - workspace/config/runflow.config.json
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - apps/cli/.runflow/runs/latest.json
  - packages/handlers/src/index.ts
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - packages/core/src/types.ts
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/tt/test.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/custom-handler/scm-handler.mjs
  - packages/core/src/index.ts
  - apps/mcp-server/src/tools.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/workspace/src/index.ts
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/config/.runflow/runs/latest.json
  - packages/handlers/src/http.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - eslint.config.mjs
  - workspace/openapi/admin-order.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/src/promotionRules.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - workspace/custom-handler/txn-token-handler.mjs
  - packages/workspace/src/format.ts
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - packages/core/src/utils.ts
  - packages/core/src/substitute.ts
  - packages/handlers/src/command.ts
  - workspace/flows/tt/post-users.yaml
  - apps/mcp-server/src/fixtures/.runflow/runs/latest.json
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/src/scm.ts
  - workspace/flows/tt/example-loop-two-branches.yaml
  - apps/cli/src/cli.ts
  - packages/workspace/src/snapshot.ts
  - workspace/openapi/admin-salepage.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/openapi/admin-location-member.yaml
  - packages/core/src/safeExpression.ts
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - workspace/src/payments.ts
  - workspace/flows/tt/params-count2.json
  - packages/core/src/handler-factory.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/src/logisticsCenter.ts
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/tt/get-users.yaml
tests:
  - packages/core/src/safeExpression.test.ts
  - packages/core/src/engine.test.ts
  - packages/core/src/utils.test.ts
  - apps/cli/src/cli.inspect.test.ts
  - packages/core/src/substitute.test.ts
  - apps/mcp-server/src/tools.test.ts
-->

---
### Requirement: Sensitive data SHALL be redacted in logs
The system SHALL redact sensitive information in HTTP request/response logs. Sensitive headers (e.g., `Authorization`, `Cookie`, `Proxy-Authorization`) SHALL NOT be included in logs. Common sensitive keys in JSON bodies (e.g., `password`, `token`, `secret`, `access_token`, `refresh_token`, `api_key`) SHALL be replaced with `[REDACTED]`.

#### Scenario: Sensitive headers omitted
- **WHEN** an HTTP request is made with an `Authorization` header
- **THEN** the header SHALL NOT appear in the log output

#### Scenario: Sensitive body fields redacted
- **WHEN** an HTTP response body is `{ "id": 1, "password": "abc" }`
- **THEN** the log SHALL show `{ "id": 1, "password": "[REDACTED]" }`


<!-- @trace
source: engine-early-termination-and-api-logging-enhancement
updated: 2026-03-06
code:
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/openapi/admin-payments.yaml
  - workspace/custom-handler/log-helper.mjs
  - packages/core/src/engine.ts
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - workspace/config/auth.json
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - workspace/config/runflow.config.json
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - apps/cli/.runflow/runs/latest.json
  - packages/handlers/src/index.ts
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - packages/core/src/types.ts
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/tt/test.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/custom-handler/scm-handler.mjs
  - packages/core/src/index.ts
  - apps/mcp-server/src/tools.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/workspace/src/index.ts
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/config/.runflow/runs/latest.json
  - packages/handlers/src/http.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - eslint.config.mjs
  - workspace/openapi/admin-order.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/src/promotionRules.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - workspace/custom-handler/txn-token-handler.mjs
  - packages/workspace/src/format.ts
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - packages/core/src/utils.ts
  - packages/core/src/substitute.ts
  - packages/handlers/src/command.ts
  - workspace/flows/tt/post-users.yaml
  - apps/mcp-server/src/fixtures/.runflow/runs/latest.json
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/src/scm.ts
  - workspace/flows/tt/example-loop-two-branches.yaml
  - apps/cli/src/cli.ts
  - packages/workspace/src/snapshot.ts
  - workspace/openapi/admin-salepage.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/openapi/admin-location-member.yaml
  - packages/core/src/safeExpression.ts
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - workspace/src/payments.ts
  - workspace/flows/tt/params-count2.json
  - packages/core/src/handler-factory.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/src/logisticsCenter.ts
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/tt/get-users.yaml
tests:
  - packages/core/src/safeExpression.test.ts
  - packages/core/src/engine.test.ts
  - packages/core/src/utils.test.ts
  - apps/cli/src/cli.inspect.test.ts
  - packages/core/src/substitute.test.ts
  - apps/mcp-server/src/tools.test.ts
-->

---
### Requirement: Large response bodies SHALL be truncated in logs
When the response body exceeds a predefined character limit (e.g., 2048 characters), the log output SHALL be truncated. A notice SHALL be appended indicating that the full response is available in the execution snapshot.

#### Scenario: Truncation notice
- **WHEN** an HTTP response body is larger than 2048 characters
- **THEN** the log SHALL show a truncated portion of the body
- **AND** the log SHALL append a message: `[Body truncated (too large). Full result saved to snapshot. Use 'inspect' command to query details.]`

<!-- @trace
source: engine-early-termination-and-api-logging-enhancement
updated: 2026-03-06
code:
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/openapi/admin-payments.yaml
  - workspace/custom-handler/log-helper.mjs
  - packages/core/src/engine.ts
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - workspace/config/auth.json
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - workspace/config/runflow.config.json
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - apps/cli/.runflow/runs/latest.json
  - packages/handlers/src/index.ts
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - packages/core/src/types.ts
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/tt/test.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/custom-handler/scm-handler.mjs
  - packages/core/src/index.ts
  - apps/mcp-server/src/tools.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/workspace/src/index.ts
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/config/.runflow/runs/latest.json
  - packages/handlers/src/http.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - eslint.config.mjs
  - workspace/openapi/admin-order.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/src/promotionRules.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - workspace/custom-handler/txn-token-handler.mjs
  - packages/workspace/src/format.ts
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - packages/core/src/utils.ts
  - packages/core/src/substitute.ts
  - packages/handlers/src/command.ts
  - workspace/flows/tt/post-users.yaml
  - apps/mcp-server/src/fixtures/.runflow/runs/latest.json
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/src/scm.ts
  - workspace/flows/tt/example-loop-two-branches.yaml
  - apps/cli/src/cli.ts
  - packages/workspace/src/snapshot.ts
  - workspace/openapi/admin-salepage.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/openapi/admin-location-member.yaml
  - packages/core/src/safeExpression.ts
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - workspace/src/payments.ts
  - workspace/flows/tt/params-count2.json
  - packages/core/src/handler-factory.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/src/logisticsCenter.ts
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/tt/get-users.yaml
tests:
  - packages/core/src/safeExpression.test.ts
  - packages/core/src/engine.test.ts
  - packages/core/src/utils.test.ts
  - apps/cli/src/cli.inspect.test.ts
  - packages/core/src/substitute.test.ts
  - apps/mcp-server/src/tools.test.ts
-->