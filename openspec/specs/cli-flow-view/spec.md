# cli-flow-view Specification

## Purpose

CLI 子指令（如 `flow view <flowId>`）可輸出 flow 的圖形表示；支援輸出格式為 Mermaid（預設）或 graph.json，與 run/list/detail 共用 resolve 與 config 規則。

## Requirements

### Requirement: CLI SHALL provide a view command

The CLI SHALL provide a subcommand (e.g. `view`) that accepts a flowId (file path or prefix-operation as in run/list/detail) and outputs the flow's graph. Resolution and config SHALL follow the same rules as the run command (e.g. `--config`, cwd, flowsDir, OpenAPI flows from config).

#### Scenario: View resolves flow by path

- **WHEN** the user runs `flow view path/to/flow.yaml` and the file exists and is valid
- **THEN** the CLI SHALL resolve and load the flow
- **AND** the CLI SHALL output the graph in the requested format (default Mermaid)

#### Scenario: View resolves flow by prefix-operation

- **WHEN** the user runs `flow view my-api-get-users` and config defines an OpenAPI flow with that operation
- **THEN** the CLI SHALL resolve and load the flow as for run
- **AND** the CLI SHALL output the graph in the requested format

#### Scenario: View fails when flow not found

- **WHEN** the flowId cannot be resolved or the file is missing
- **THEN** the CLI SHALL emit an error message and exit with non-zero
- **AND** no graph output SHALL be written to stdout

---
### Requirement: View SHALL support Mermaid output

The view command SHALL support output format Mermaid (e.g. `--output mermaid` or default). The output SHALL be valid Mermaid flowchart syntax (e.g. flowchart TB), with nodes for each DAG step and edges representing dependsOn (dependency → dependent).

#### Scenario: Default output is Mermaid

- **WHEN** the user runs `flow view flow.yaml` with no output option
- **THEN** the CLI SHALL print Mermaid flowchart text to stdout
- **AND** the output SHALL be pasteable into Mermaid-supported editors or Mermaid Live

#### Scenario: Mermaid nodes and edges match DAG

- **WHEN** a flow has steps A (root) and B with dependsOn [A]
- **THEN** the Mermaid output SHALL include nodes for A and B and an edge from A to B
- **AND** orphan steps SHALL NOT appear in the Mermaid output

---
### Requirement: View SHALL support JSON graph output

The view command SHALL support output format JSON (e.g. `--output json`) that conforms to the flow-graph-format spec: nodes array and edges array, with optional flowName/flowDescription.

#### Scenario: JSON output conforms to flow-graph-format

- **WHEN** the user runs `flow view flow.yaml --output json`
- **THEN** the CLI SHALL print a single JSON object to stdout
- **AND** the object SHALL contain `nodes` (array) and `edges` (array)
- **AND** each node SHALL have `id`; each edge SHALL have `source` and `target`

#### Scenario: JSON is machine-readable

- **WHEN** the output is JSON
- **THEN** the output SHALL be valid JSON (e.g. parseable by JSON.parse)
- **AND** the CLI SHALL NOT mix non-JSON text (e.g. log messages) with the JSON on stdout

---
### Requirement: Step display in run summary
The CLI SHALL display a summary of steps after a flow execution.

#### Scenario: Filtered summary
- **WHEN** the flow execution finishes
- **THEN** the system SHALL ONLY display steps that are either unsuccessful (failed) OR contain a non-empty log
- **AND** successful steps with empty logs SHALL be hidden from the summary

#### Scenario: No iteration markers
- **WHEN** displaying steps from a loop iteration
- **THEN** the system SHALL NOT display standalone iteration header lines (e.g., `loop [iteration 1]`)
- **AND** the step ID itself SHALL be used to distinguish iterations (e.g., `loop.iteration_1.step`)

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