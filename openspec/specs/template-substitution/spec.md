# template-substitution Specification

## Purpose

定義步驟字串的模板替換：在適用欄位（至少 command 步驟的 `run`）中，支援 `{{ key }}`、dot 語法（`{{ key.nested }}`）、中括號語法（`{{ tags[0] }}`），從當前 context 取值；若值為物件或陣列則以 JSON.stringify 代入，否則轉字串。替換在執行該步驟前、使用當時累積的 context 執行。

## Requirements

### Requirement: Command step run SHALL support template substitution

The value of the `run` field of a step with `type: command` SHALL be processed for template substitution before being passed to the shell. Substitution SHALL use the current step context (initial params plus outputs of all previous steps). The syntax SHALL include root keys, dot notation for nested properties, bracket notation for array indices, and array processing methods (map, filter, slice).

#### Scenario: Root key substitution
- **WHEN** context is `{ who: 'world' }` and the command step has `run: "echo Hello {{ who }}"`
- **THEN** the string passed to the shell is `echo Hello world`
- **AND** the step runs with that command

#### Scenario: Dot notation
- **WHEN** context is `{ config: { debug: true, level: 2 } }` and run is `run: "echo {{ config.level }}"`
- **THEN** the substituted string is `echo 2`
- **AND** nested property is resolved correctly

#### Scenario: Bracket notation for array index
- **WHEN** context is `{ tags: ['a', 'b', 'c'] }` and run is `run: "echo {{ tags[0] }}"`
- **THEN** the substituted string is `echo a`
- **AND** array index 0 is resolved

#### Scenario: Array map method
- **WHEN** context is `{ users: [{id: 1, name: 'A'}, {id: 2, name: 'B'}] }` and run is `run: "echo {{ users.map(id) }}"`
- **THEN** the substituted string is `echo [1,2]`
- **AND** the property `id` is extracted from each array element

#### Scenario: Array filter method
- **WHEN** context is `{ items: [1, 2, 3, 4] }` and run is `run: "echo {{ items.filter(val > 2) }}"`
- **THEN** the substituted string is `echo [3,4]` (assuming basic comparison support)
- **AND** elements satisfying the condition are kept

#### Scenario: Array slice method
- **WHEN** context is `{ list: [1, 2, 3, 4, 5] }` and run is `run: "echo {{ list.slice(0, 2) }}"`
- **THEN** the substituted string is `echo [1,2]`
- **AND** a subset of the array is returned


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
### Requirement: Object and array values SHALL be JSON stringified

When the resolved value for a placeholder is an object or an array, the substitution SHALL use the result of `JSON.stringify(value)` (implementation-defined formatting, e.g. no extra whitespace). When the value is string, number, or boolean, it SHALL be converted to string directly.

#### Scenario: Object value

- **WHEN** context is `{ config: { a: 1, b: 2 } }` and run is `run: "echo {{ config }}"`
- **THEN** the substituted string is `echo {"a":1,"b":2}` (or equivalent JSON without unnecessary spaces)
- **AND** the command receives a single JSON string

#### Scenario: Array value

- **WHEN** context is `{ tags: ['x', 'y'] }` and run is `run: "echo {{ tags }}"`
- **THEN** the substituted string is `echo ["x","y"]` (or equivalent)
- **AND** the command receives a JSON array string

---
### Requirement: Undefined or null SHALL resolve to empty string

When resolving a path (e.g. `{{ key.nested }}` or `{{ items[5] }}`), if any intermediate step yields `undefined` or `null`, the substitution result for that placeholder SHALL be the empty string `""`.

#### Scenario: Missing key

- **WHEN** context is `{ a: 1 }` and run is `run: "echo {{ b }}"`
- **THEN** the substituted string is `echo ` (empty where {{ b }} was)
- **AND** no error is thrown; substitution completes

#### Scenario: Null in path

- **WHEN** context is `{ obj: null }` and run is `run: "echo {{ obj.foo }}"`
- **THEN** the substituted string is `echo ` (empty)
- **AND** accessing property of null yields empty string

---
### Requirement: Substitution SHALL use current context at step execution time

Substitution for a step SHALL be performed immediately before executing that step, using the context as it exists at that time. Context SHALL have initial params at top level and previous step outputs namespaced by step id (see step-context). The same context SHALL be used for both substitution and (where applicable) step execution.

#### Scenario: Context from prior step (namespaced by step id)

- **WHEN** step 1 with `id: 'step1'` (e.g. js) returned `outputs: { version: '1.0' }` and step 2 is command with `run: "echo {{ step1.version }}"`
- **THEN** step 2's run is substituted with context including `step1.version === '1.0'`
- **AND** the command sees `echo 1.0`