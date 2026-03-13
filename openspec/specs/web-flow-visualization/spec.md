# web-flow-visualization Specification

## Purpose

Web 應用或頁面以 React Flow（或同等圖庫）渲染 flow DAG，節點顯示 step id/type 等，邊表示 dependsOn；資料可來自 graph.json 或 FlowDefinition。

## Requirements

### Requirement: Viewer SHALL render a flow graph from graph.json

The web visualization SHALL accept input in the flow-graph-format (nodes + edges, e.g. from CLI `flow view --output json`). It SHALL render a directed graph where nodes correspond to steps and edges correspond to dependencies (source → target as in the format).

#### Scenario: Load graph from JSON

- **WHEN** the user provides or uploads a graph.json (flow-graph-format)
- **THEN** the viewer SHALL render nodes for each node in the JSON
- **AND** the viewer SHALL render edges for each edge in the JSON
- **AND** the layout SHALL be readable (e.g. hierarchical or automatic layout)

#### Scenario: Node labels show step id and optionally type

- **WHEN** a node has `id` and optionally `type` or `label`
- **THEN** the viewer SHALL display at least the step id on the node
- **AND** the viewer MAY display type or label when present

---
### Requirement: Viewer MAY accept FlowDefinition

The web visualization MAY accept a FlowDefinition (e.g. parsed flow YAML or JSON). When accepted, the viewer SHALL derive the graph (nodes/edges) according to the same rules as flow-graph-format (DAG steps only, edges from dependency to dependent).

#### Scenario: Derive graph from FlowDefinition

- **WHEN** the user provides a FlowDefinition (e.g. pasted YAML or uploaded file)
- **THEN** the viewer SHALL build the set of nodes from steps that have dependsOn
- **AND** the viewer SHALL build edges from each dependency to the step that depends on it
- **AND** the rendered graph SHALL match what flow-graph-format would produce for the same flow

---
### Requirement: Viewer SHALL be read-only
The visualization SHALL be read-only: it SHALL NOT execute the flow, SHALL NOT modify the flow definition, and SHALL NOT persist changes. Interaction MAY include zoom, pan, and optional selection/highlight. In live mode (WebSocket connected), the viewer SHALL dynamically reflect external execution progress and DSL updates but SHALL NOT initiate execution. (Note: Only `RUN` command from client is allowed via WebSocket).

#### Scenario: No execution results popup
- **WHEN** the flow run completes in the viewer (live mode)
- **THEN** the viewer SHALL NOT display a modal dialog (ResultDialog)
- **AND** the viewer SHALL instead rely on the Sidebar Log Panel for execution results


<!-- @trace
source: optimize-execution-ui
updated: 2026-03-14
code:
  - packages/viewer/server/index.ts
  - packages/viewer/server/workspace-handlers.ts
  - packages/viewer/server/watcher.ts
  - apps/cli/src/dev.ts
  - packages/viewer/src/types.ts
  - packages/viewer/server/state.ts
  - packages/viewer/package.json
  - packages/viewer/src/App.tsx
  - packages/viewer/server/execution.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/server/workspace-api.ts
  - packages/viewer/server/app.ts
tests:
  - packages/viewer/server/workspace-api.test.ts
  - packages/viewer/server/execution.test.ts
  - packages/viewer/src/hooks/use-websocket.test.ts
  - packages/viewer/server/workspace-handlers.test.ts
  - packages/viewer/server/state.test.ts
-->

---
### Requirement: Viewer SHALL support WebSocket connection for live updates

The viewer SHALL support an optional WebSocket connection to receive real-time updates from a CLI `dev` mode server.

#### Scenario: Handle DSL updates via WebSocket

- **WHEN** the viewer receives a `FLOW_RELOAD` message with new graph data
- **THEN** the viewer SHALL re-render the flow graph with the updated nodes and edges
- **AND** the viewer SHALL preserve the current view (zoom/pan) if feasible

#### Scenario: Handle execution status via WebSocket

- **WHEN** the viewer receives a `STEP_STATE_CHANGE` message with a step ID and new status
- **THEN** the viewer SHALL visually update the corresponding node's state (e.g., color, progress bar, icon)
- **AND** the status update SHALL be applied without re-rendering the entire graph structure

<!-- @trace
source: real-time-flow-preview
updated: 2026-03-09
code:
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - packages/viewer/src/components/ResultDialog.tsx
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - apps/flow-viewer/src/flowDefinitionToGraph.ts
  - packages/viewer/src/components/ui/input.tsx
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - apps/flow-viewer/src/components/FlowSidebar.tsx
  - apps/flow-viewer/index.html
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - apps/flow-viewer/components.json
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - apps/flow-viewer/src/components/ParamsSheet.tsx
  - packages/viewer/src/components/ui/button.tsx
  - apps/flow-viewer/src/hooks/use-flow-graph.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - workspace/openapi/admin-invoice.yaml
  - apps/flow-viewer/src/hooks/use-mobile.ts
  - packages/viewer/src/components/ui/skeleton.tsx
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/flows/tt/post-users.yaml
  - apps/flow-viewer/src/hooks/use-workspace.ts
  - workspace/flows/tt/params-count2.json
  - packages/viewer/src/components/ui/separator.tsx
  - apps/flow-viewer/src/types.ts
  - pnpm-workspace.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/src/logisticsCenter.ts
  - apps/flow-viewer/src/index.css
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - packages/viewer/index.html
  - workspace/custom-handler/txn-last-token-handler.mjs
  - packages/viewer/src/components/ui/select.tsx
  - packages/viewer/src/index.css
  - apps/flow-viewer/src/components/ParamsForm.tsx
  - apps/flow-viewer/tsconfig.json
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/src/payments.ts
  - apps/flow-viewer/src/components/ui/tabs.tsx
  - workspace/custom-handler/logistics-center-handler.mjs
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - packages/viewer/src/components/ParamsSheet.tsx
  - ARCHITECTURAL_REFORM.md
  - packages/viewer/src/lib/utils.ts
  - packages/workspace/src/config.ts
  - apps/flow-viewer/src/hooks/use-theme.ts
  - packages/viewer/src/layout.ts
  - workspace/custom-handler/txn-token-handler.mjs
  - apps/flow-viewer/src/App.tsx
  - apps/flow-viewer/src/lib/params.ts
  - packages/viewer/src/components/FlowHeader.tsx
  - packages/viewer/package.json
  - apps/flow-viewer/server/index.ts
  - packages/viewer/src/hooks/use-flow-graph.ts
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - apps/flow-viewer/src/components/ui/button.tsx
  - workspace/openapi/admin-delivery.yaml
  - packages/viewer/tsup.config.ts
  - apps/flow-viewer/src/components/ui/input.tsx
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/src/scm.ts
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/config/runflow.config.json
  - apps/flow-viewer/src/layout.ts
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - packages/viewer/src/App.tsx
  - apps/flow-viewer/src/components/ui/sidebar.tsx
  - packages/viewer/src/components/ui/card.tsx
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/openapi/admin-location-member.yaml
  - packages/workspace/src/discover.ts
  - workspace/openapi/admin-location-point.yaml
  - packages/viewer/server/lib/index.ts
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - packages/viewer/src/main.tsx
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/src/promotionRules.ts
  - workspace/custom-handler/promotion-rules-handler.mjs
  - apps/flow-viewer/package.json
  - packages/viewer/vite.config.ts
  - apps/flow-viewer/src/components/FlowMainContent.tsx
  - apps/flow-viewer/src/components/ui/sheet.tsx
  - apps/flow-viewer/src/components/ui/card.tsx
  - packages/viewer/src/components/ui/switch.tsx
  - apps/flow-viewer/src/flowGraphToReactFlow.ts
  - apps/flow-viewer/src/lib/nested.ts
  - packages/viewer/src/components/ui/collapsible.tsx
  - apps/flow-viewer/vitest.config.ts
  - apps/flow-viewer/src/components/ui/tooltip.tsx
  - packages/viewer/src/components/ParamsForm.tsx
  - packages/viewer/src/components/ui/sheet.tsx
  - apps/flow-viewer/src/components/ui/separator.tsx
  - packages/viewer/src/lib/nested.ts
  - workspace/flows/logistics/91app-shipping.yaml
  - packages/viewer/src/hooks/use-workspace.ts
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - apps/flow-viewer/src/components/ui/dialog.tsx
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - packages/viewer/vitest.config.ts
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - workspace/openapi/admin-pos.yaml
  - apps/flow-viewer/src/lib/utils.ts
  - apps/cli/src/dev.ts
  - packages/core/src/safeExpression.ts
  - packages/viewer/components.json
  - packages/core/src/types.ts
  - packages/viewer/src/flowGraphToReactFlow.ts
  - packages/viewer/server/index.ts
  - packages/viewer/src/lib/params.ts
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/order/batch-order-confirm.yaml
  - packages/viewer/src/components/FlowMainContent.tsx
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/tt/get-users.yaml
  - workspace/openapi/logistics-center.yaml
  - apps/flow-viewer/src/components/ui/select.tsx
  - apps/cli/src/cli.ts
  - packages/viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/src/components/FlowCanvas.tsx
  - packages/viewer/src/components/ui/sidebar.tsx
  - packages/viewer/src/types.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - packages/viewer/server/workspace-api.ts
  - workspace/flows/tt/test.yaml
  - packages/viewer/src/flowDefinitionToGraph.ts
  - packages/viewer/src/components/ui/tabs.tsx
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - apps/flow-viewer/vite.config.ts
  - packages/viewer/src/components/ui/tooltip.tsx
  - packages/viewer/src/hooks/use-theme.ts
  - packages/viewer/src/components/FlowCanvas.tsx
  - workspace/openapi/admin-payments.yaml
  - apps/flow-viewer/src/components/ui/skeleton.tsx
  - apps/cli/package.json
  - workspace/config/auth.json
  - workspace/flows/tt/get-users-userId.yaml
  - apps/flow-viewer/src/components/ui/collapsible.tsx
  - packages/viewer/tsconfig.json
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - apps/flow-viewer/src/components/FlowHeader.tsx
  - apps/flow-viewer/src/components/ui/switch.tsx
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - workspace/openapi/admin-promotion.yaml
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/openapi/admin-order.yaml
  - apps/flow-viewer/src/main.tsx
  - apps/flow-viewer/server/workspace-api.ts
  - apps/flow-viewer/src/components/ResultDialog.tsx
  - packages/viewer/src/hooks/use-mobile.ts
  - packages/viewer/src/components/FlowSidebar.tsx
  - workspace/custom-handler/scm-handler.mjs
  - packages/core/src/engine.ts
tests:
  - apps/flow-viewer/src/flowGraphToReactFlow.test.ts
  - apps/flow-viewer/src/flowDefinitionToGraph.test.ts
  - packages/viewer/server/workspace-api.test.ts
  - packages/core/src/hooks_v2.test.ts
  - packages/core/src/hooks.test.ts
  - packages/viewer/src/layout.test.ts
  - apps/flow-viewer/src/layout.test.ts
  - apps/flow-viewer/server/workspace-api.test.ts
  - packages/viewer/src/flowGraphToReactFlow.test.ts
  - packages/viewer/src/flowDefinitionToGraph.test.ts
-->

<!-- @trace
source: refactor-viewer-to-package
updated: 2026-03-09
code:
  - workspace/config/auth.json
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/viewer/src/components/ui/switch.tsx
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - packages/viewer/components.json
  - packages/viewer/src/components/ui/button.tsx
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - apps/flow-viewer/server/index.ts
  - workspace/flows/tt/post-users.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - apps/flow-viewer/src/App.tsx
  - apps/flow-viewer/tsconfig.json
  - apps/flow-viewer/index.html
  - packages/viewer/src/hooks/use-workspace.ts
  - apps/flow-viewer/src/flowGraphToReactFlow.ts
  - packages/viewer/vitest.config.ts
  - packages/workspace/src/discover.ts
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - apps/flow-viewer/components.json
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/flows/tt/params-count2.json
  - workspace/openapi/logistics-center.yaml
  - apps/flow-viewer/src/components/ui/sidebar.tsx
  - packages/viewer/src/components/ui/dialog.tsx
  - apps/flow-viewer/vite.config.ts
  - workspace/custom-handler/txn-token-handler.mjs
  - apps/flow-viewer/src/components/ResultDialog.tsx
  - apps/flow-viewer/src/lib/params.ts
  - apps/flow-viewer/src/components/ui/select.tsx
  - apps/flow-viewer/src/components/ui/sheet.tsx
  - packages/core/src/safeExpression.ts
  - packages/viewer/index.html
  - apps/flow-viewer/src/hooks/use-theme.ts
  - apps/flow-viewer/src/lib/utils.ts
  - apps/flow-viewer/src/layout.ts
  - apps/flow-viewer/src/main.tsx
  - packages/viewer/src/hooks/use-flow-graph.ts
  - packages/viewer/src/layout.ts
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - packages/core/src/types.ts
  - apps/flow-viewer/src/components/FlowSidebar.tsx
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/openapi/admin-payments.yaml
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/openapi/admin-promotion.yaml
  - packages/viewer/src/types.ts
  - packages/viewer/vite.config.ts
  - packages/viewer/server/lib/index.ts
  - apps/flow-viewer/src/components/ui/switch.tsx
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - apps/flow-viewer/src/components/ui/separator.tsx
  - packages/viewer/src/lib/utils.ts
  - packages/viewer/src/components/ui/input.tsx
  - apps/flow-viewer/src/flowDefinitionToGraph.ts
  - packages/viewer/src/main.tsx
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - apps/flow-viewer/src/components/ui/skeleton.tsx
  - packages/viewer/src/components/ParamsForm.tsx
  - workspace/custom-handler/payments-handler.mjs
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - packages/workspace/src/config.ts
  - packages/viewer/src/components/ResultDialog.tsx
  - apps/flow-viewer/package.json
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/flows/order/batch-order-confirm.yaml
  - apps/flow-viewer/src/components/ui/card.tsx
  - workspace/flows/tt/get-users.yaml
  - workspace/flows/tt/test.yaml
  - packages/viewer/src/flowDefinitionToGraph.ts
  - packages/viewer/src/components/ui/tooltip.tsx
  - workspace/flows/tt/example-loop-two-branches.yaml
  - apps/cli/src/cli.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - packages/viewer/src/components/FlowCanvas.tsx
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/openapi/admin-location.yaml
  - apps/flow-viewer/src/components/FlowCanvas.tsx
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/src/logisticsCenter.ts
  - workspace/src/promotionRules.ts
  - workspace/flows/logistics/delivery-shipment.yaml
  - apps/flow-viewer/src/components/FlowHeader.tsx
  - apps/cli/src/dev.ts
  - apps/flow-viewer/vitest.config.ts
  - apps/flow-viewer/src/hooks/use-mobile.ts
  - packages/viewer/src/lib/params.ts
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - packages/viewer/src/components/ui/skeleton.tsx
  - packages/viewer/tsup.config.ts
  - workspace/custom-handler/txn-last-token-handler.mjs
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - packages/viewer/src/components/ui/sidebar.tsx
  - apps/flow-viewer/src/lib/nested.ts
  - packages/viewer/src/lib/nested.ts
  - apps/flow-viewer/src/components/ui/button.tsx
  - apps/flow-viewer/src/components/ui/tooltip.tsx
  - packages/viewer/src/components/ui/sheet.tsx
  - pnpm-workspace.yaml
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - packages/viewer/tsconfig.json
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - workspace/openapi/admin-order.yaml
  - apps/flow-viewer/src/hooks/use-workspace.ts
  - packages/viewer/src/index.css
  - apps/flow-viewer/src/components/ParamsSheet.tsx
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - packages/viewer/package.json
  - workspace/openapi/admin-location-point.yaml
  - packages/viewer/src/App.tsx
  - apps/flow-viewer/server/workspace-api.ts
  - packages/viewer/src/components/ui/tabs.tsx
  - packages/viewer/src/hooks/use-theme.ts
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/payment/payments-transaction-query.yaml
  - packages/viewer/src/hooks/use-mobile.ts
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - packages/viewer/src/components/ui/separator.tsx
  - workspace/src/payments.ts
  - apps/flow-viewer/src/components/FlowMainContent.tsx
  - apps/flow-viewer/src/components/ui/tabs.tsx
  - packages/viewer/src/components/FlowSidebar.tsx
  - apps/flow-viewer/src/index.css
  - packages/viewer/src/components/ParamsSheet.tsx
  - apps/cli/package.json
  - workspace/flows/logistics/91app-shipping.yaml
  - packages/viewer/server/workspace-api.ts
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - packages/viewer/src/flowGraphToReactFlow.ts
  - workspace/src/scm.ts
  - packages/viewer/src/components/FlowMainContent.tsx
  - workspace/config/runflow.config.json
  - apps/flow-viewer/src/components/ParamsForm.tsx
  - packages/viewer/src/components/ui/card.tsx
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - apps/flow-viewer/src/types.ts
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - packages/viewer/src/components/ui/select.tsx
  - apps/flow-viewer/src/components/ui/collapsible.tsx
  - ARCHITECTURAL_REFORM.md
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/openapi/admin-location-member.yaml
  - packages/viewer/src/components/FlowHeader.tsx
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - apps/flow-viewer/src/hooks/use-flow-graph.ts
  - packages/core/src/engine.ts
  - packages/viewer/server/index.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/src/components/ui/collapsible.tsx
  - apps/flow-viewer/src/components/ui/input.tsx
  - apps/flow-viewer/src/components/ui/dialog.tsx
tests:
  - packages/core/src/hooks.test.ts
  - apps/flow-viewer/src/flowDefinitionToGraph.test.ts
  - apps/flow-viewer/src/flowGraphToReactFlow.test.ts
  - packages/viewer/src/flowDefinitionToGraph.test.ts
  - packages/viewer/src/layout.test.ts
  - apps/flow-viewer/server/workspace-api.test.ts
  - apps/flow-viewer/src/layout.test.ts
  - packages/viewer/server/workspace-api.test.ts
  - packages/viewer/src/flowGraphToReactFlow.test.ts
  - packages/core/src/hooks_v2.test.ts
-->

---
### Requirement: Viewer SHALL support dynamic canvas resizing
The web visualization SHALL allow the canvas to resize and re-center (fitView) when the execution sidebar opens or closes.

#### Scenario: Resize canvas with sidebar toggle
- **WHEN** the Sidebar is opened (e.g., manually or during execution)
- **THEN** the viewer SHALL reduce its available width and adjust the React Flow canvas
- **AND** the viewer SHALL optionally call `fitView` to keep the graph centered

<!-- @trace
source: optimize-execution-ui
updated: 2026-03-14
code:
  - packages/viewer/server/index.ts
  - packages/viewer/server/workspace-handlers.ts
  - packages/viewer/server/watcher.ts
  - apps/cli/src/dev.ts
  - packages/viewer/src/types.ts
  - packages/viewer/server/state.ts
  - packages/viewer/package.json
  - packages/viewer/src/App.tsx
  - packages/viewer/server/execution.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/server/workspace-api.ts
  - packages/viewer/server/app.ts
tests:
  - packages/viewer/server/workspace-api.test.ts
  - packages/viewer/server/execution.test.ts
  - packages/viewer/src/hooks/use-websocket.test.ts
  - packages/viewer/server/workspace-handlers.test.ts
  - packages/viewer/server/state.test.ts
-->