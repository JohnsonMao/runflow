# convention-to-flow Specification

## Purpose

定義從「約定格式」（例如 OpenAPI YAML）轉成 Runflow flow 的轉換規格與套件介面，使每個 API／操作可對應為一可執行的 flow，並與現有 loader/executor 銜接。

## Requirements

### Requirement: The system SHALL provide a convention-to-flow adapter interface

The system SHALL expose an adapter interface (or package) that accepts a convention document (e.g. OpenAPI YAML path or parsed object) and SHALL produce one or more Runflow flow objects (or equivalent YAML-serializable structure) that conform to the existing flow schema. Each produced flow SHALL be executable by the existing executor and loader. The adapter SHALL NOT modify the convention source; conversion SHALL be read-only from the source.

#### Scenario: OpenAPI document yields one flow per path+method

- **WHEN** the adapter is given an OpenAPI 3.x document with paths `/users` (GET) and `/users` (POST)
- **THEN** the adapter SHALL produce at least two flows (or flow definitions), each representing one operation
- **AND** each produced flow SHALL contain steps that, when executed, perform the corresponding HTTP request (e.g. via existing http step type) with url, method, and optional headers/body derived from the OpenAPI operation

#### Scenario: Produced flow is valid Runflow YAML

- **WHEN** the adapter produces a flow object
- **THEN** the flow SHALL have `name` and `steps` (array) compatible with the existing parser
- **AND** each step SHALL have `id` and `type` and SHALL be executable by the registered handler for that type (e.g. `http`, `js`)

#### Scenario: Adapter is invokable from CLI or programmatic API

- **WHEN** a caller (CLI, MCP, or script) invokes the convention-to-flow adapter with a source path or URL and optional options
- **THEN** the adapter SHALL return the generated flow(s) (in memory or written to a path) without requiring manual YAML editing
- **AND** the caller SHALL be able to pass options such as base URL, output directory, or naming convention for generated flows

#### Scenario: Adapter SHALL support in-memory-only output

- **WHEN** the caller requests in-memory-only output (e.g. option `output: 'memory'` or no `outputDir` and a flag), and the convention document has many operations (e.g. dozens or hundreds of APIs)
- **THEN** the adapter SHALL produce and return all generated flow(s) as in-memory object(s) only and SHALL NOT write to the filesystem
- **AND** the caller SHALL be able to run a single flow by id/path+method or stream/iterate over flows without persisting them
- **AND** this mode SHALL be the default or explicitly selectable so that large API sets do not require writing many files

#### Scenario: Operation keys SHALL be normalized

- **WHEN** the adapter generates an operation key from an OpenAPI path and method (e.g., via `toOperationKey` function)
- **THEN** the operation key SHALL be normalized according to the flow-id-normalization specification
- **AND** URL-encoded characters in the path SHALL be decoded and normalized to underscores (e.g., `tt%2Fpost-users` → `tt_post-users`)
- **AND** the normalized operation key SHALL be used as the key in the returned flow map and for identifying the operation


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
### Requirement: Convention-to-flow SHALL map operation parameters to flow params

When the convention document defines parameters (e.g. OpenAPI parameters, requestBody), the adapter SHALL map them to the flow's top-level `params` declaration (ParamDeclaration array) so that the generated flow SHALL accept the same inputs as the API contract. Optional parameters SHALL be reflected as non-required params; types SHALL be mapped to the existing param types (string, number, boolean, array, object) where applicable.

#### Scenario: OpenAPI path/query params become flow params

- **WHEN** an OpenAPI operation has parameters `id` (path, required) and `limit` (query, optional, integer)
- **THEN** the generated flow SHALL declare `params` with at least `{ name: 'id', type: 'string', required: true }` and `{ name: 'limit', type: 'number', required: false }` (or equivalent)
- **AND** the flow steps SHALL use these params (e.g. in url template `{{ params.id }}`) so that running the flow with `params: { id: '1', limit: 10 }` produces the correct request

#### Scenario: Request body becomes flow param when applicable

- **WHEN** the operation has a requestBody (e.g. application/json schema)
- **THEN** the adapter MAY expose it as a flow param (e.g. `body` or a named param) so that callers can pass the body when running the flow
- **AND** the generated http step SHALL use that param for the request body (e.g. `body: '{{ params.body }}'` or equivalent)

---
### Requirement: Convention-to-flow SHALL support inserting steps before and after each operation API during conversion

During conversion, the adapter SHALL accept an optional **hook configuration** that specifies, for each generated flow (or per operation), zero or more steps to insert **before** the operation's API step and zero or more steps to insert **after** it. The adapter SHALL emit a single flow per operation whose steps are ordered as: [before steps] → [API step] → [after steps], using `dependsOn` so that the resulting flow is valid Runflow with no new step types or fields. The adapter SHALL NOT add any `before` or `after` fields to steps; only plain steps and `dependsOn` SHALL be used.

#### Scenario: Insert steps before and after the API step for an operation

- **WHEN** the adapter is invoked with a hook config that for operation `GET /users` specifies before-steps `[{ id: 'auth', type: 'js', run: '...' }]` and after-steps `[{ id: 'log', type: 'js', run: '...' }]`
- **THEN** the generated flow for `GET /users` SHALL contain, in order, steps equivalent to: auth (dependsOn []), api step (dependsOn ['auth']), log (dependsOn [api step id])
- **AND** the flow SHALL be executable by the existing executor with no special hook handling

#### Scenario: Different operations SHALL support different inserted steps

- **WHEN** the hook configuration specifies for operation `GET /users` before-steps [auth] and after-steps [log], and for operation `POST /users` before-steps [auth, validateBody] and after-steps [notify]
- **THEN** the generated flow for `GET /users` SHALL include only auth and log around the API step
- **AND** the generated flow for `POST /users` SHALL include auth, validateBody before and notify after the API step
- **AND** identification of operations SHALL be by path+method, operationId, or a stable adapter-defined key so that the config can target specific operations

#### Scenario: Conversion without hook config yields only the API step(s)

- **WHEN** the adapter is invoked with no hook configuration (or empty hooks)
- **THEN** each generated flow SHALL contain only the steps that perform the API call (and any adapter-default steps), with no extra before/after steps
- **AND** behavior SHALL remain unchanged from the case where hook support is not used

---
### Requirement: Generated flows SHALL integrate with existing loader and executor

Generated flows SHALL be loadable by the existing flow loader (file path or in-memory object). They SHALL use only step types and features already specified in the main specs (e.g. http-request-step, flow-params-schema). The adapter SHALL NOT require changes to the core executor or parser contract; integration SHALL be via standard flow structure and optional loader extension (e.g. resolve virtual paths or inline flow objects) if needed.

#### Scenario: Generated flow runs with run(flow, { params })

- **WHEN** a flow produced by the adapter is passed to the existing `run(flow, { params })` (or equivalent) API
- **THEN** the executor SHALL run the flow and execute each step via the existing registry
- **AND** params SHALL be validated against the flow's params declaration if present (per flow-params-schema)

#### Scenario: CLI can run a flow generated from a convention file

- **WHEN** the CLI is extended to support a mode such as "run from OpenAPI" (e.g. `runflow run --from-openapi openapi.yaml --operation GET /users`)
- **THEN** the CLI SHALL use the convention-to-flow adapter to obtain the flow, then SHALL execute it with the existing run path (e.g. same as `runflow run flow.yaml` with params from CLI args or file)
- **AND** behavior SHALL be consistent with running a hand-written flow of the same structure