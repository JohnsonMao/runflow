# custom-node-registry Specification

## Purpose

定義統一節點介面與註冊機制：所有 step 均透過 StepHandler 介面執行；執行引擎僅依 Registry 分派；Parser 產出通用 step 結構。Registry 由呼叫端建立並傳入（內建 handler 來自 `@runflow/handlers`）；引擎不提供預設 registry。

## Requirements

### Requirement: StepHandler interface SHALL be the single execution contract

The system SHALL define a new handler contract via `defineHandler({ schema?, flowControl?, run: (context: HandlerContext) => Promise<SimpleResult | void> })`. Every step type (including built-in and custom) MUST be executed by invoking the `run` function provided by the handler's factory. The engine SHALL NOT branch on step type with built-in logic; it SHALL only look up the handler configuration and invoke its `run` method.

#### Scenario: Execution dispatches via registry
- **WHEN** a flow step has `type: 'http'` and the caller-provided registry is used
- **THEN** the executor looks up the handler configuration for `'http'` in the registry and calls its `run` function with the step context
- **AND** the handler MAY report results via `context.report()` or `return`


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
### Requirement: StepContext SHALL provide params, previous outputs, and flowFilePath

`StepContext` MUST include at least: `params` (or equivalent merged view of initial params and previous step outputs), and `flowFilePath` (optional, for handlers that need to resolve file paths). The engine SHALL pass the same context shape to every handler so that built-in and custom handlers behave consistently.

#### Scenario: Handler receives previous outputs in context under step id

- **WHEN** step A with `id: 'a'` produced `outputs: { x: 1 }` and step B is about to run
- **THEN** the context passed to step B's handler SHALL include `params.a.x === 1` (A's outputs under `params.a`; initial params remain at top level)
- **AND** template substitution SHALL have been applied to the step by the executor before invoking the handler (so the handler receives a substituted snapshot)

---
### Requirement: StepResult contract SHALL be unchanged

Handlers MUST return a value that conforms to the existing `StepResult` shape: `stepId`, `success`, `stdout`, `stderr`, and optionally `error`, `outputs`. The engine SHALL assign `context[stepId] = outputs` (or `{}` when absent) for the next step when the result is used; flow-level success SHALL be false if any step's `success` is false. See step-context for namespaced accumulation.

#### Scenario: Handler returns StepResult with outputs

- **WHEN** a handler returns `{ stepId: 's1', success: true, stdout: '', stderr: '', outputs: { key: 'value' } }`
- **THEN** the engine sets `context.s1 = { key: 'value' }` for subsequent steps (outputs namespaced by step id)
- **AND** the next step's handler receives context that includes `params.s1.key === 'value'`

---
### Requirement: Engine SHALL NOT provide a default registry; registry SHALL be required when flow has steps

The system SHALL define a registry type (e.g. `StepRegistry`) and SHALL export `registerStepHandler(registry, type, handler)` so that callers can build a registry. The engine SHALL NOT provide a default registry or `createDefaultRegistry`. When the flow has steps to execute, `run(flow, options)` SHALL require a valid `registry` in `RunOptions`; if `registry` is missing, the engine SHALL fail fast (e.g. throw or return a failed result with a clear message such as "registry is required"). Callers that need built-in step types SHALL depend on `@runflow/handlers` and use a helper (e.g. `createBuiltinRegistry()` or `registerBuiltinHandlers(registry)`), then pass that registry to `run()`.

#### Scenario: Run without registry fails or is invalid

- **WHEN** the caller invokes `run(flow, {})` with no `registry` and the flow has at least one step
- **THEN** the engine SHALL require `registry` (e.g. throw or return a failed result with a message like "registry is required")
- **AND** there SHALL be no implicit default registry from core

#### Scenario: Caller builds registry from handlers package and runs

- **WHEN** the caller does `const registry = createBuiltinRegistry()` from `@runflow/handlers`, then `run(flow, { registry })`
- **THEN** the executor uses that registry for dispatch
- **AND** built-in step types behave as before

#### Scenario: Caller can override or extend registry

- **WHEN** the caller passes `registry` in `RunOptions` (e.g. by using createBuiltinRegistry and adding a handler, or by providing a full custom registry)
- **THEN** the engine SHALL use that registry for dispatch
- **AND** custom step types in the flow SHALL be executed if registered; unregistered types SHALL produce an error result per requirement below

---
### Requirement: Unregistered step type SHALL produce an error result

When a step's `type` is not present in the registry used for the run, the engine SHALL NOT throw. It SHALL produce a `StepResult` for that step with `success: false` and `error` set to a string that identifies the unknown type (e.g. "Unknown step type: xxx"). The flow's overall success SHALL be false.

#### Scenario: Unknown step type returns error result

- **WHEN** a flow contains a step with `type: 'unknownType'` and the registry has no handler for `'unknownType'`
- **THEN** the executor produces a StepResult for that step with `success: false` and `error` containing the type name
- **AND** the run continues to the next step (no exception thrown)
- **AND** the flow result has `success: false`

---
### Requirement: Handler exceptions SHALL be caught and converted to StepResult

If a registered handler throws (or rejects), the engine SHALL catch the exception and SHALL produce a `StepResult` for that step with `success: false` and `error` set to a string representation of the error. The flow SHALL NOT abort with an unhandled exception.

#### Scenario: Handler throws

- **WHEN** a handler throws or returns a rejected promise
- **THEN** the executor catches it and produces a StepResult with `success: false` and `error` set
- **AND** no outputs from that step are written into context (that step id is not updated)
- **AND** the flow result has `success: false`

---
### Requirement: FlowStep SHALL be a generic shape

`FlowStep` SHALL be defined as a generic object with at least `id: string` and `type: string`, and any additional keys (e.g. `[key: string]: unknown`) preserved for the handler. The parser SHALL produce this shape for every step; it SHALL NOT validate type-specific fields for built-in types (validation responsibility moves to handlers or optional schema).

#### Scenario: Parser accepts any string type

- **WHEN** YAML contains a step with `id: 's1'`, `type: 'custom'`, and extra keys `foo: 1`, `bar: 'x'`
- **THEN** the parser SHALL include a step object with `id: 's1'`, `type: 'custom'`, and the extra keys preserved
- **AND** the parser SHALL NOT return null solely because `type` is not a known built-in

#### Scenario: Parser requires id and type

- **WHEN** a step in YAML is missing `id` or `type`, or `type` is not a string
- **THEN** the parser SHALL return null (invalid flow) or otherwise reject the step

---
### Requirement: Substitution SHALL be applied by the executor before calling handler

Before invoking a step's handler, the executor SHALL apply template substitution to the step's string-valued fields using the current context (params and previous outputs). The handler SHALL receive the step object with substitution already applied so that handlers do not need to perform substitution themselves.

#### Scenario: Handler receives substituted step

- **WHEN** context has `base: 'https://api.example.com'` and the step has `url: '{{ base }}/users'`
- **THEN** the executor substitutes and passes to the handler a step with `url: 'https://api.example.com/users'`
- **AND** the handler may use the step as-is without calling substitute

---
### Requirement: CLI SHALL build registry using @runflow/handlers plus config and --registry

The CLI SHALL build its registry by using the built-in handlers from `@runflow/handlers`, then merge config `handlers` and `--registry` modules. The engine SHALL NOT provide that default. (1) **Config file**: the config's `handlers` property SHALL be a record mapping step type names to module paths (relative to the config file directory). (2) **--registry <path>**: the CLI SHALL load the given module's default export. The CLI SHALL support direct loading of `.ts` handler files using a runtime loader (e.g., `tsx` or `jiti`) so that users can define handlers without a separate build step.

#### Scenario: CLI runs flow with .ts custom handler
- **WHEN** the user runs the CLI with a config file that has `handlers: { echo: './echo-handler.ts' }`
- **THEN** the CLI SHALL use a dynamic loader to import the factory from the TS file
- **AND** the CLI SHALL initialize the factory with the tool context and register the resulting handler
- **AND** the flow step with `type: 'echo'` SHALL be executed correctly

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