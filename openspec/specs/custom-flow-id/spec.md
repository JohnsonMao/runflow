# custom-flow-id Specification

## Purpose

TBD - created by archiving change 'flow-viewer-enhancements-and-fixes'. Update Purpose after archive.

## Requirements

### Requirement: Custom Flow ID definition
The `FlowDefinition` SHALL support an optional `id` property of type string.

#### Scenario: Flow with custom ID
- **WHEN** a Flow YAML includes an `id` field (e.g., `id: my-flow`)
- **THEN** the system SHALL use this value as the primary `flowId` for execution and display
- **AND** the file path SHALL be preserved as a secondary identifier for internal resolution


<!-- @trace
source: flow-viewer-enhancements-and-fixes
updated: 2026-03-07
code:
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - apps/flow-viewer/src/components/ui/tabs.tsx
  - apps/flow-viewer/src/components/ui/sheet.tsx
  - apps/flow-viewer/src/types.ts
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/tt/get-users.yaml
  - apps/mcp-server/src/index.ts
  - packages/workspace/src/index.ts
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/custom-handler/scm-handler.mjs
  - apps/flow-viewer/src/components/ui/button.tsx
  - workspace/openapi/admin-location-member.yaml
  - workspace/src/logisticsCenter.ts
  - workspace/flows/tt2/sub.yaml
  - apps/flow-viewer/src/App.tsx
  - workspace/flows/tt/test.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/src/scm.ts
  - workspace/src/promotionRules.ts
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/custom-handler/logistics-center-handler.mjs
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/tt/params-count2.json
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - apps/flow-viewer/src/components/ui/tooltip.tsx
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/openapi/admin-order.yaml
  - apps/flow-viewer/src/components/ui/sidebar.tsx
  - packages/core/src/types.ts
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - pnpm-workspace.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/custom-handler/txn-token-handler.mjs
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/openapi/admin-invoice.yaml
  - apps/flow-viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/package.json
  - workspace/openapi/admin-payments.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - packages/core/vitest.config.ts.timestamp-1772879449411-47a2c693c8a97.mjs
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/src/payments.ts
  - workspace/config/runflow.config.json
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - apps/flow-viewer/src/components/ui/collapsible.tsx
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - apps/flow-viewer/src/components/ui/select.tsx
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - apps/flow-viewer/src/hooks/use-flow-graph.ts
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/config/auth.json
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - apps/flow-viewer/src/components/FlowSidebar.tsx
  - packages/workspace/src/format.ts
  - apps/cli/src/cli.ts
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - apps/flow-viewer/src/components/ui/separator.tsx
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - packages/workspace/src/discover.ts
  - workspace/flows/tt/post-users.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - apps/cli/src/cli.test-utils.ts
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/openapi/admin-pos.yaml
tests:
  - apps/flow-viewer/server/workspace-api.test.ts
  - apps/cli/src/cli.run.test.ts
-->

---
### Requirement: Global Flow ID uniqueness
Every `flowId` in a workspace (whether derived from file path, OpenAPI operation, or custom `id`) SHALL be unique.

#### Scenario: Duplicate custom ID detection
- **WHEN** two or more flows define the same `id` value
- **THEN** the workspace loader SHALL record a critical error identifying the conflicting files
- **AND** the `flow-viewer` SHALL display a global error message on startup if duplicates are found
- **AND** the `mcp-server` SHALL log the error to stderr but continue loading other valid flows


<!-- @trace
source: flow-viewer-enhancements-and-fixes
updated: 2026-03-07
code:
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - apps/flow-viewer/src/components/ui/tabs.tsx
  - apps/flow-viewer/src/components/ui/sheet.tsx
  - apps/flow-viewer/src/types.ts
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/tt/get-users.yaml
  - apps/mcp-server/src/index.ts
  - packages/workspace/src/index.ts
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/custom-handler/scm-handler.mjs
  - apps/flow-viewer/src/components/ui/button.tsx
  - workspace/openapi/admin-location-member.yaml
  - workspace/src/logisticsCenter.ts
  - workspace/flows/tt2/sub.yaml
  - apps/flow-viewer/src/App.tsx
  - workspace/flows/tt/test.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/src/scm.ts
  - workspace/src/promotionRules.ts
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/custom-handler/logistics-center-handler.mjs
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/tt/params-count2.json
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - apps/flow-viewer/src/components/ui/tooltip.tsx
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/openapi/admin-order.yaml
  - apps/flow-viewer/src/components/ui/sidebar.tsx
  - packages/core/src/types.ts
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - pnpm-workspace.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/custom-handler/txn-token-handler.mjs
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/openapi/admin-invoice.yaml
  - apps/flow-viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/package.json
  - workspace/openapi/admin-payments.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - packages/core/vitest.config.ts.timestamp-1772879449411-47a2c693c8a97.mjs
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/src/payments.ts
  - workspace/config/runflow.config.json
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - apps/flow-viewer/src/components/ui/collapsible.tsx
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - apps/flow-viewer/src/components/ui/select.tsx
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - apps/flow-viewer/src/hooks/use-flow-graph.ts
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/config/auth.json
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - apps/flow-viewer/src/components/FlowSidebar.tsx
  - packages/workspace/src/format.ts
  - apps/cli/src/cli.ts
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - apps/flow-viewer/src/components/ui/separator.tsx
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - packages/workspace/src/discover.ts
  - workspace/flows/tt/post-users.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - apps/cli/src/cli.test-utils.ts
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/openapi/admin-pos.yaml
tests:
  - apps/flow-viewer/server/workspace-api.test.ts
  - apps/cli/src/cli.run.test.ts
-->

---
### Requirement: ID priority in navigation
The system SHALL prioritize the custom `id` over the file path when generating links and breadcrumbs.

#### Scenario: Navigation with custom ID
- **WHEN** a flow has both a file path `basic/test.yaml` and an `id: login-test`
- **THEN** the URL parameter `?flowId=login-test` SHALL be used to identify and load the flow
- **AND** the sidebar SHALL mark the corresponding entry as active based on this ID

<!-- @trace
source: flow-viewer-enhancements-and-fixes
updated: 2026-03-07
code:
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - apps/flow-viewer/src/components/ui/tabs.tsx
  - apps/flow-viewer/src/components/ui/sheet.tsx
  - apps/flow-viewer/src/types.ts
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/tt/get-users.yaml
  - apps/mcp-server/src/index.ts
  - packages/workspace/src/index.ts
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/custom-handler/scm-handler.mjs
  - apps/flow-viewer/src/components/ui/button.tsx
  - workspace/openapi/admin-location-member.yaml
  - workspace/src/logisticsCenter.ts
  - workspace/flows/tt2/sub.yaml
  - apps/flow-viewer/src/App.tsx
  - workspace/flows/tt/test.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/src/scm.ts
  - workspace/src/promotionRules.ts
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/custom-handler/logistics-center-handler.mjs
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/tt/params-count2.json
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - apps/flow-viewer/src/components/ui/tooltip.tsx
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/openapi/admin-order.yaml
  - apps/flow-viewer/src/components/ui/sidebar.tsx
  - packages/core/src/types.ts
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - pnpm-workspace.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - workspace/custom-handler/txn-token-handler.mjs
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/openapi/admin-invoice.yaml
  - apps/flow-viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/package.json
  - workspace/openapi/admin-payments.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - packages/core/vitest.config.ts.timestamp-1772879449411-47a2c693c8a97.mjs
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/src/payments.ts
  - workspace/config/runflow.config.json
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - apps/flow-viewer/src/components/ui/collapsible.tsx
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - apps/flow-viewer/src/components/ui/select.tsx
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/openapi/admin-location-point.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - apps/flow-viewer/src/hooks/use-flow-graph.ts
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/config/auth.json
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - apps/flow-viewer/src/components/FlowSidebar.tsx
  - packages/workspace/src/format.ts
  - apps/cli/src/cli.ts
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - apps/flow-viewer/src/components/ui/separator.tsx
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - packages/workspace/src/discover.ts
  - workspace/flows/tt/post-users.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - apps/cli/src/cli.test-utils.ts
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/openapi/admin-pos.yaml
tests:
  - apps/flow-viewer/server/workspace-api.test.ts
  - apps/cli/src/cli.run.test.ts
-->