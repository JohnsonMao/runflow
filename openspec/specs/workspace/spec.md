# workspace Specification

## Purpose

定義 **@runflow/workspace**（packages/workspace）的職責與對外介面：僅提供工作區「資料與解析」及 list/detail 的 Markdown 格式化，不負責誰載入 config、不負責執行 flow。CLI 與 MCP 依賴 workspace 取得 config、catalog、resolveFlow 與 list/detail 的 Markdown 輸出。

## Requirements

### Requirement: Workspace SHALL provide config discovery and loading

The `RunflowConfig`'s `handlers` property SHALL support being an array of module paths (strings). When an array is provided, the workspace SHALL load each module, invoke the factory (or factories) it exports, and SHALL register them in a registry where their internal `type` property is used as the key. The workspace SHALL NO LONGER require a mapping object where the type key is specified in the config.

#### Scenario: Array-based handler configuration in config
- **WHEN** a config defines `handlers: ['./my-echo.ts', './my-log.ts']` (array format)
- **THEN** the workspace loader SHALL import each file and register them according to their internal `type`
- **AND** the handler type SHALL NOT be specified in the config file (it comes from the factory)


<!-- @trace
source: standardize-handler-factory
updated: 2026-03-05
code:
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/openapi/simple.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - packages/handlers/src/set.ts
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/tt/test.yaml
  - workspace/config/auth.json
  - packages/workspace/src/config.ts
  - packages/core/src/validateCanBeDependedOn.ts
  - packages/handlers/src/message.ts
  - workspace/config/runflow.config.json
  - packages/handlers/src/condition.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/tt/post-users.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - packages/handlers/src/loop.ts
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - packages/handlers/src/index.ts
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/openapi/admin-order.yaml
  - workspace/openapi/admin-payments.yaml
  - packages/core/src/handler-factory.ts
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - packages/handlers/package.json
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - apps/cli/src/cli.ts
  - packages/core/src/engine.ts
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/src/payments.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - packages/core/src/utils.ts
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - packages/core/src/handler-adapter.ts
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/openapi/admin-promotion.yaml
  - packages/handlers/src/flow.ts
  - packages/core/src/types.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - workspace/flows/tt/get-users.yaml
  - workspace/custom-handler/test.mjs
  - workspace/openapi/admin-location-point.yaml
  - packages/core/src/index.ts
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - packages/handlers/src/sleep.ts
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/src/scm.ts
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/openapi/admin-location-member.yaml
  - apps/mcp-server/src/index.ts
  - packages/handlers/src/http.ts
  - packages/handlers/src/test-helpers.ts
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/tt/params-count2.json
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
tests:
  - packages/convention-openapi/src/integration.test.ts
  - apps/cli/src/cli.run.test.ts
  - apps/mcp-server/src/index.test.ts
  - packages/handlers/src/sleep.test.ts
  - packages/workspace/src/config.test.ts
  - packages/core/src/validateCanBeDependedOn.test.ts
  - packages/handlers/src/http.test.ts
  - packages/core/src/engine.test.ts
  - packages/handlers/src/loop.test.ts
  - packages/core/src/run.test.ts
  - packages/core/src/handler-factory.test.ts
  - packages/handlers/src/message.test.ts
  - packages/handlers/src/flow.test.ts
  - packages/handlers/src/condition.test.ts
  - packages/handlers/src/set.test.ts
-->

---
### Requirement: Workspace SHALL provide flowId resolution (resolveFlowId)

The workspace SHALL export **resolveFlowId(flowId, config, configDir, cwd)** returning **ResolvedFlow** (file or openapi). OpenAPI-type flowIds SHALL be resolved only from **config.handlers**: for each key whose value is an object with **specPaths**, if flowId is of the form `${key}-${operation}` (operation non-empty), the result SHALL be ResolvedFlow of type openapi with **specPaths** (resolved array of absolute paths), **operation**, and **options** (including stepType = key and the entry's baseUrl, operationFilter, paramExpose). ResolvedFlow of type openapi SHALL NOT include specPath, openApiSpecPath, or openApiOperationKey. When multiple handler keys match, the longest matching key SHALL win. Caller is responsible for loading the flow (e.g. by merging specs from specPaths and calling openApiToFlows) and building the registry; workspace does not execute flows.

#### Scenario: resolveFlowId returns file path for file-type flowId

- **WHEN** config has flowsDir (or cwd is used) and the caller invokes resolveFlowId(relativePath, config, configDir, cwd) with a path that does not match any handlers OpenAPI prefix, or with a path under flowsDir/cwd
- **THEN** the return value SHALL be ResolvedFlow of type file with resolved path
- **AND** file-type flowIds SHALL NOT be resolved from config.openapi (no openapi block)
- **AND** file-type flow resolution SHALL use only flowsDir (or cwd when flowsDir is absent) as the base directory; no other path scope SHALL apply

#### Scenario: resolveFlowId returns openapi for handlerKey-operationKey flowId

- **WHEN** config has handlers[key] as an OpenAPI entry (object with specPaths) and the caller invokes resolveFlowId('key-operation', config, configDir, cwd)
- **THEN** the return value SHALL be ResolvedFlow of type openapi with specPaths (resolved array), operation, and options (stepType = key, baseUrl, operationFilter, paramExpose from that entry)
- **AND** the return value SHALL NOT contain specPath, openApiSpecPath, or openApiOperationKey
- **AND** the caller MAY then load the flow by merging the specs at specPaths and calling openApiToFlows(mergedSpec, { stepType: key, ... })

---
### Requirement: Workspace SHALL provide discover catalog and entry lookup

The workspace SHALL export **findFlowFiles**, **buildDiscoverCatalog(config, configDir, cwd)**, and **getDiscoverEntry(catalog, flowId)**. buildDiscoverCatalog SHALL return **DiscoverEntry[]**. OpenAPI-derived entries SHALL be produced only from **config.handlers**: for each key whose value is an OpenAPI entry (object with **specPaths**), the implementation SHALL merge the specs at specPaths, call openApiToFlows on the merged result, and SHALL add entries with flowId `key-operationKey`. buildDiscoverCatalog SHALL NOT read or use a top-level config.openapi. **DEFAULT_DISCOVER_LIMIT** and **MAX_DISCOVER_LIMIT** SHALL both be **10**. Caller applies keyword, limit, offset. File flows SHALL be discovered only from the **flowsDir** (or cwd when flowsDir is absent); no other directory SHALL be used for file flow scope.

#### Scenario: getDiscoverEntry returns entry by flowId

- **WHEN** the caller has a catalog from buildDiscoverCatalog and invokes getDiscoverEntry(catalog, flowId)
- **THEN** if flowId exists in the catalog the return value SHALL be that DiscoverEntry
- **AND** if not found the return value SHALL be undefined (or equivalent)

#### Scenario: buildDiscoverCatalog returns file and OpenAPI flows from handlers only

- **WHEN** config has flowsDir and at least one handlers entry that is an OpenAPI entry (object with specPaths), and the caller invokes buildDiscoverCatalog(config, configDir, cwd)
- **THEN** the returned array SHALL include entries for file flows (flowId = path relative to flowsDir or cwd) and for OpenAPI flows (flowId = handlerKey-operationKey) derived only from handlers (merged spec per entry)
- **AND** each entry SHALL have flowId, name, description (optional), params (optional, ParamDeclaration[])
- **AND** the implementation SHALL NOT include entries from any top-level config.openapi

---
### Requirement: Workspace SHALL provide list and detail Markdown formatting

The workspace SHALL export **formatListAsMarkdown(entries, limit, offset)** and **formatDetailAsMarkdown(entry)**. These SHALL produce the same Markdown text used by the CLI and MCP for discover_flow_list and discover_flow_detail (table with flowId | name; pagination hint when applicable; detail with flowId, name, description, params). CLI and MCP SHALL use these functions so that list/detail presentation is consistent and maintained in one place.

#### Scenario: formatListAsMarkdown produces table and pagination hint

- **WHEN** the caller invokes formatListAsMarkdown(entries, limit, offset) with non-empty entries and limit/offset
- **THEN** the return value SHALL be Markdown with a first line for total and range, a table with columns flowId | name, and when offset + limit < total a pagination hint line (e.g. "Next: offset=N")

#### Scenario: formatDetailAsMarkdown produces single-flow detail

- **WHEN** the caller invokes formatDetailAsMarkdown(entry)
- **THEN** the return value SHALL be Markdown that includes the flow's flowId, name, description, and params (path/query/body; body fields MAY be expanded)

---
### Requirement: Workspace SHALL provide createResolveFlow for core

The `buildRegistryFromConfig` helper in the workspace package SHALL be updated to import the `builtinHandlers` array from `@runflow/handlers`. It SHALL initialize these factories and combine them with any custom handlers from the config to build the final `StepRegistry` using the array-based `buildRegistry` mechanism.

#### Scenario: Building full registry with builtin and custom handlers
- **WHEN** `buildRegistryFromConfig(config)` is called
- **THEN** it SHALL combine the `builtinHandlers` array with the handlers loaded from the config
- **AND** it SHALL return a `StepRegistry` containing both built-in and custom handlers correctly mapped by their internal `type`


<!-- @trace
source: standardize-handler-factory
updated: 2026-03-05
code:
  - workspace/flows/convenience-store/seven-eleven-tcat-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-pickup-confirm.yaml
  - workspace/flows/convenience-store/store-to-store-complete-flow.yaml
  - workspace/flows/logistics/delivery-shipment.yaml
  - workspace/openapi/admin-pos.yaml
  - workspace/flows/promotion/create-special-price-promotion.yaml
  - workspace/openapi/admin-salepage.yaml
  - workspace/openapi/simple.yaml
  - workspace/flows/convenience-store/convenience-store-master-flow.yaml
  - packages/handlers/src/set.ts
  - workspace/openapi/admin-invoice.yaml
  - workspace/flows/tt/test.yaml
  - workspace/config/auth.json
  - packages/workspace/src/config.ts
  - packages/core/src/validateCanBeDependedOn.ts
  - packages/handlers/src/message.ts
  - workspace/config/runflow.config.json
  - packages/handlers/src/condition.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-rate-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-arrived-confirm.yaml
  - workspace/flows/tt/post-users.yaml
  - workspace/openapi/store-front-outer-member-login.yaml
  - workspace/openapi/store-to-store-shipping.yaml
  - workspace/flows/location-pickup/location-pickup-shipping.yaml
  - packages/handlers/src/loop.ts
  - workspace/flows/convenience-store/store-to-store-shipping.yaml
  - workspace/flows/logistics/logistics-smart-master-flow.yaml
  - packages/handlers/src/index.ts
  - workspace/flows/promotion/create-discount-reach-price-with-amount-promotion.yaml
  - workspace/flows/convenience-store/store-to-store-shipping-confirm.yaml
  - workspace/openapi/admin-order.yaml
  - workspace/openapi/admin-payments.yaml
  - packages/core/src/handler-factory.ts
  - workspace/flows/convenience-store/family-mart-fulfillment-complete.yaml
  - workspace/flows/promotion/create-multi-buy-lowest-price-free-promotion.yaml
  - packages/handlers/package.json
  - workspace/flows/order/batch-order-confirm.yaml
  - workspace/custom-handler/scm-handler.mjs
  - workspace/flows/logistics/logistics-center-fulfillment-complete.yaml
  - apps/cli/src/cli.ts
  - packages/core/src/engine.ts
  - workspace/flows/promotion/create-reach-piece-free-gift-promotion.yaml
  - workspace/src/payments.ts
  - workspace/flows/promotion/create-discount-reach-piece-with-price-promotion.yaml
  - packages/core/src/utils.ts
  - workspace/flows/convenience-store/store-shipping-confirm.yaml
  - workspace/flows/tt/get-users-userId.yaml
  - workspace/flows/payment/payment-cardtoken-flow.yaml
  - workspace/openapi/admin-promotion-rules.yaml
  - workspace/flows/location-pickup/location-pickup-ship-confirm.yaml
  - packages/core/src/handler-adapter.ts
  - workspace/flows/promotion/create-reach-price-free-gift-promotion.yaml
  - workspace/openapi/admin-promotion.yaml
  - packages/handlers/src/flow.ts
  - packages/core/src/types.ts
  - workspace/flows/promotion/create-discount-nth-piece-with-rate-promotion.yaml
  - workspace/flows/tt/get-users.yaml
  - workspace/custom-handler/test.mjs
  - workspace/openapi/admin-location-point.yaml
  - packages/core/src/index.ts
  - workspace/flows/logistics/delivery-order-confirm-and-shipping.yaml
  - workspace/flows/payment/payments-transaction-query.yaml
  - workspace/flows/salepage/create-sale-page-flow.yaml
  - packages/handlers/src/sleep.ts
  - workspace/flows/tt2/sub.yaml
  - workspace/flows/promotion/create-addon-salepage-extra-purchase-promotion.yaml
  - apps/flow-viewer/server/workspace-api.ts
  - workspace/flows/convenience-store/seven-eleven-tcat-ship-confirm.yaml
  - workspace/flows/promotion/create-reach-groups-piece-promotion.yaml
  - workspace/openapi/admin-delivery.yaml
  - workspace/flows/logistics/91app-shipping.yaml
  - workspace/flows/logistics/hk-logistics-smart-master-flow.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-amount-promotion.yaml
  - workspace/flows/location-pickup/location-pickup-cancel-order.yaml
  - workspace/flows/convenience-store/store-order-confirm-and-shipping.yaml
  - workspace/src/scm.ts
  - workspace/flows/salepage/update-sale-page-images-flow.yaml
  - workspace/flows/tt/example-loop-two-branches.yaml
  - workspace/flows/promotion/create-discount-reach-price-with-rate-promotion.yaml
  - workspace/flows/payment/payment-txntoken-flow.yaml
  - workspace/flows/logistics/logistics-center-fulfillment-fail.yaml
  - workspace/openapi/admin-location.yaml
  - workspace/flows/convenience-store/store-shipping.yaml
  - workspace/flows/promotion/create-discount-nth-piece-with-price-promotion.yaml
  - workspace/openapi/admin-location-member.yaml
  - apps/mcp-server/src/index.ts
  - packages/handlers/src/http.ts
  - packages/handlers/src/test-helpers.ts
  - workspace/flows/promotion/create-register-reach-price-promotion.yaml
  - workspace/flows/logistics/91app-ship-confirm.yaml
  - workspace/flows/tt/params-count2.json
  - workspace/flows/promotion/create-register-reach-piece-promotion.yaml
  - workspace/flows/promotion/promotion-rule-activate.yaml
  - workspace/openapi/logistics-center.yaml
  - workspace/flows/promotion/create-discount-reach-piece-with-amount-promotion.yaml
tests:
  - packages/convention-openapi/src/integration.test.ts
  - apps/cli/src/cli.run.test.ts
  - apps/mcp-server/src/index.test.ts
  - packages/handlers/src/sleep.test.ts
  - packages/workspace/src/config.test.ts
  - packages/core/src/validateCanBeDependedOn.test.ts
  - packages/handlers/src/http.test.ts
  - packages/core/src/engine.test.ts
  - packages/handlers/src/loop.test.ts
  - packages/core/src/run.test.ts
  - packages/core/src/handler-factory.test.ts
  - packages/handlers/src/message.test.ts
  - packages/handlers/src/flow.test.ts
  - packages/handlers/src/condition.test.ts
  - packages/handlers/src/set.test.ts
-->

---
### Requirement: LoadedFlow and resolveAndLoadFlow return only flow

When the workspace exports **resolveAndLoadFlow** or when load is used after resolve, the loaded result SHALL be an object with only **flow** (FlowDefinition). It SHALL NOT include flowFilePath, openApiContext, specPath, path, openApiSpecPath, or openApiOperationKey. Runners (CLI, MCP) and step handlers SHALL receive only the flow when resolving or loading a flow; no spec or file path metadata SHALL be passed for validation or override use.

#### Scenario: resolveAndLoadFlow returns only flow

- **WHEN** the caller invokes resolveAndLoadFlow(flowId, config, configDir, cwd)
- **THEN** the return value SHALL be an object **{ flow: FlowDefinition }**
- **AND** the return value SHALL NOT have flowFilePath or openApiContext

#### Scenario: createResolveFlow(flowId) returns only { flow } or null

- **WHEN** the resolver returned by createResolveFlow is invoked with a valid flowId
- **THEN** the resolved result SHALL be **{ flow }** or null
- **AND** the result SHALL NOT contain flowFilePath, openApiContext, specPath, or path

## Non-requirements (out of scope)

- Workspace does not define how the registry is built (CLI and MCP build it from config.handlers only).
- Workspace does not define config path source (e.g. no RUNFLOW_CONFIG; caller uses --config or findConfigFile(cwd)).
- Workspace does not cache config or catalog; caching is the responsibility of the caller (e.g. MCP caches, CLI does not).