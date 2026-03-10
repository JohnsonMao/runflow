# flow-id-normalization Specification

## Purpose

TBD - created by archiving change 'normalize-flow-ids-and-validate-duplicates'. Update Purpose after archive.

## Requirements

### Requirement: The system SHALL provide a Flow ID normalization function

The system SHALL expose a normalization function that accepts a Flow ID string and SHALL return a normalized Flow ID string. The normalization function SHALL:
1. Decode URL-encoded characters (e.g., `%2F` → `/`, `%3A` → `:`)
2. Convert all special characters to underscore `_`, except hyphens `-`, underscores `_`, and dots `.` which SHALL be preserved
3. Collapse consecutive underscores into a single underscore
4. Remove leading and trailing underscores

#### Scenario: URL-encoded characters are decoded and normalized

- **WHEN** a Flow ID contains URL-encoded characters such as `tt%2Fpost-users.yaml` or `scm%3Apost-scm-V1-Category-GetCategory`
- **THEN** the normalization function SHALL decode them first (e.g., `%2F` → `/`, `%3A` → `:`)
- **AND** SHALL then convert the decoded special characters to underscores, resulting in `tt_post-users.yaml` and `scm_post-scm-V1-Category-GetCategory` respectively

#### Scenario: Valid characters are preserved

- **WHEN** a Flow ID contains hyphens `-`, underscores `_`, or dots `.`
- **THEN** these characters SHALL be preserved as-is in the normalized ID
- **AND** other special characters (e.g., `/`, `:`, `%`, spaces) SHALL be converted to underscores

#### Scenario: Consecutive underscores are collapsed

- **WHEN** normalization produces consecutive underscores (e.g., `get__users` or `api___call`)
- **THEN** the normalization function SHALL collapse them into a single underscore (e.g., `get_users`, `api_call`)

#### Scenario: Leading and trailing underscores are removed

- **WHEN** normalization produces a Flow ID with leading or trailing underscores (e.g., `_get-users` or `get-users_`)
- **THEN** the normalization function SHALL remove them, resulting in `get-users`

#### Scenario: Invalid URL encoding is handled gracefully

- **WHEN** a Flow ID contains invalid URL-encoded characters that cause `decodeURIComponent` to throw an error
- **THEN** the normalization function SHALL catch the error and SHALL skip the decoding step for that ID
- **AND** SHALL continue with the normalization process using the original string


<!-- @trace
source: normalize-flow-ids-and-validate-duplicates
updated: 2026-03-09
code:
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - packages/workspace/src/discover.ts
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - packages/viewer/src/hooks/use-flow-graph.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - packages/convention-openapi/src/openApiToFlows.ts
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/openapi/admin-order.yaml
  - workspace/src/payments.ts
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/config/runflow.config.json
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/flows/tt/params-count2.json
  - packages/viewer/src/App.tsx
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - ARCHITECTURAL_REFORM.md
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/config/auth.json
  - pnpm-workspace.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - workspace/flows/tt2/sub.yaml
  - workspace/openapi/admin-location-member.yaml
  - packages/viewer/package.json
  - workspace/flows/tt/get-users.yaml
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/src/promotionRules.ts
  - workspace/openapi/logistics-center.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - apps/cli/src/dev.ts
  - packages/convention-openapi/src/writeFlows.ts
  - packages/convention-openapi/src/collectOperations.ts
  - packages/core/src/index.ts
  - workspace/custom-handler/txn-token-handler.mjs
  - packages/core/src/utils.ts
  - workspace/flows/convenience-store/store-shipping.yaml
  - packages/core/src/handler-factory.ts
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - packages/viewer/src/hooks/use-websocket.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - workspace/openapi/admin-salepage.yaml
  - workspace/src/scm.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/openapi/admin-payments.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/tt/test.yaml
  - workspace/src/logisticsCenter.ts
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/flows/tt/post-users.yaml
  - packages/viewer/src/types.ts
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - packages/convention-openapi/src/types.ts
  - packages/viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - apps/mcp-server/src/tools.ts
  - packages/workspace/src/config.ts
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/viewer/server/lib/index.ts
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
tests:
  - packages/viewer/server/workspace-api.test.ts
  - packages/convention-openapi/src/writeFlows.test.ts
  - packages/convention-openapi/src/collectOperations.test.ts
  - packages/core/src/utils.test.ts
  - packages/workspace/src/discover.test.ts
-->

---
### Requirement: Flow IDs SHALL be normalized during catalog discovery

When building the discover catalog, the system SHALL normalize all Flow IDs before storing them in the catalog and before performing duplicate validation. This SHALL apply to:
1. Flow IDs from Flow YAML files (from the `id` field or file path)
2. Flow IDs from OpenAPI handlers (format: `handlerKey:operationKey`)

#### Scenario: Flow YAML IDs are normalized during catalog discovery

- **WHEN** `buildDiscoverCatalog` processes a Flow YAML file with an `id` field containing special characters (e.g., `id: tt%2Fpost-users.yaml`)
- **THEN** the catalog entry SHALL use the normalized ID (e.g., `tt_post-users.yaml`)
- **AND** the original ID SHALL be preserved for error reporting if needed

#### Scenario: OpenAPI handler Flow IDs are normalized during catalog discovery

- **WHEN** `buildDiscoverCatalog` processes OpenAPI handlers and generates Flow IDs in the format `handlerKey:operationKey`
- **THEN** the entire Flow ID string SHALL be normalized (e.g., `scm:post-scm-V1-Category-GetCategory` → `scm_post-scm-V1-Category-GetCategory`)
- **AND** the normalized ID SHALL be used in the catalog entry

#### Scenario: File path-based IDs are normalized

- **WHEN** a Flow YAML file has no `id` field and the system uses the relative file path as the Flow ID (e.g., `tt/post-users.yaml`)
- **THEN** the path SHALL be normalized (e.g., `tt_post-users.yaml`)
- **AND** the normalized ID SHALL be used in the catalog entry


<!-- @trace
source: normalize-flow-ids-and-validate-duplicates
updated: 2026-03-09
code:
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - packages/workspace/src/discover.ts
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - packages/viewer/src/hooks/use-flow-graph.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - packages/convention-openapi/src/openApiToFlows.ts
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/openapi/admin-order.yaml
  - workspace/src/payments.ts
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/config/runflow.config.json
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/flows/tt/params-count2.json
  - packages/viewer/src/App.tsx
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - ARCHITECTURAL_REFORM.md
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/config/auth.json
  - pnpm-workspace.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - workspace/flows/tt2/sub.yaml
  - workspace/openapi/admin-location-member.yaml
  - packages/viewer/package.json
  - workspace/flows/tt/get-users.yaml
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/src/promotionRules.ts
  - workspace/openapi/logistics-center.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - apps/cli/src/dev.ts
  - packages/convention-openapi/src/writeFlows.ts
  - packages/convention-openapi/src/collectOperations.ts
  - packages/core/src/index.ts
  - workspace/custom-handler/txn-token-handler.mjs
  - packages/core/src/utils.ts
  - workspace/flows/convenience-store/store-shipping.yaml
  - packages/core/src/handler-factory.ts
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - packages/viewer/src/hooks/use-websocket.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - workspace/openapi/admin-salepage.yaml
  - workspace/src/scm.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/openapi/admin-payments.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/tt/test.yaml
  - workspace/src/logisticsCenter.ts
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/flows/tt/post-users.yaml
  - packages/viewer/src/types.ts
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - packages/convention-openapi/src/types.ts
  - packages/viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - apps/mcp-server/src/tools.ts
  - packages/workspace/src/config.ts
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/viewer/server/lib/index.ts
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
tests:
  - packages/viewer/server/workspace-api.test.ts
  - packages/convention-openapi/src/writeFlows.test.ts
  - packages/convention-openapi/src/collectOperations.test.ts
  - packages/core/src/utils.test.ts
  - packages/workspace/src/discover.test.ts
-->

---
### Requirement: The system SHALL validate for duplicate Flow IDs after normalization

After normalizing all Flow IDs, the system SHALL check for duplicates and SHALL report errors when duplicate normalized IDs are found. The error message SHALL include:
1. The normalized Flow ID that is duplicated
2. The original Flow IDs that resulted in the duplicate
3. The source locations of the duplicate IDs

#### Scenario: Duplicate normalized IDs are detected

- **WHEN** two different Flow IDs normalize to the same value (e.g., `tt%2Fpost-users.yaml` and `tt/post-users.yaml` both normalize to `tt_post-users.yaml`)
- **THEN** the system SHALL detect the duplicate during catalog discovery
- **AND** SHALL mark the catalog entry with an error message indicating the duplicate
- **AND** the error message SHALL include both original IDs and the normalized ID

#### Scenario: Error message provides context for duplicate IDs

- **WHEN** a duplicate normalized Flow ID is detected
- **THEN** the error message SHALL be in the format: `Duplicate flowId: ${normalizedId} (original: ${originalId}, already defined in ${source})`
- **AND** SHALL include sufficient information to identify and resolve the conflict

#### Scenario: First occurrence of a normalized ID is accepted

- **WHEN** multiple Flow IDs normalize to the same value
- **THEN** the first occurrence SHALL be accepted and stored in the catalog
- **AND** subsequent occurrences SHALL be marked with duplicate error messages

<!-- @trace
source: normalize-flow-ids-and-validate-duplicates
updated: 2026-03-09
code:
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - packages/workspace/src/discover.ts
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - packages/viewer/src/hooks/use-flow-graph.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - packages/convention-openapi/src/openApiToFlows.ts
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/openapi/admin-order.yaml
  - workspace/src/payments.ts
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/config/runflow.config.json
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/flows/tt/params-count2.json
  - packages/viewer/src/App.tsx
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - ARCHITECTURAL_REFORM.md
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/config/auth.json
  - pnpm-workspace.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - workspace/flows/tt2/sub.yaml
  - workspace/openapi/admin-location-member.yaml
  - packages/viewer/package.json
  - workspace/flows/tt/get-users.yaml
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/src/promotionRules.ts
  - workspace/openapi/logistics-center.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - apps/cli/src/dev.ts
  - packages/convention-openapi/src/writeFlows.ts
  - packages/convention-openapi/src/collectOperations.ts
  - packages/core/src/index.ts
  - workspace/custom-handler/txn-token-handler.mjs
  - packages/core/src/utils.ts
  - workspace/flows/convenience-store/store-shipping.yaml
  - packages/core/src/handler-factory.ts
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - packages/viewer/src/hooks/use-websocket.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - workspace/openapi/admin-salepage.yaml
  - workspace/src/scm.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/openapi/admin-payments.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/tt/test.yaml
  - workspace/src/logisticsCenter.ts
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/flows/tt/post-users.yaml
  - packages/viewer/src/types.ts
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - packages/convention-openapi/src/types.ts
  - packages/viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - apps/mcp-server/src/tools.ts
  - packages/workspace/src/config.ts
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/viewer/server/lib/index.ts
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
tests:
  - packages/viewer/server/workspace-api.test.ts
  - packages/convention-openapi/src/writeFlows.test.ts
  - packages/convention-openapi/src/collectOperations.test.ts
  - packages/core/src/utils.test.ts
  - packages/workspace/src/discover.test.ts
-->