## Why

OpenAPI and step handlers are configured in two separate places (`config.openapi` and `config.handlers`), which duplicates the idea of “handler type” (override vs handler key) and makes it harder to see which handler runs which spec. Unifying OpenAPI under `handlers` gives a single place for both module paths and spec-based flows, and makes the handler key the step type so override/overrideStepType are no longer needed.

## What Changes

- **Handlers accept two value shapes**: a **string** (path to a .mjs step handler, unchanged) or an **OpenAPI entry object** with `specPath` and optional `baseUrl`, `operationFilter`, `paramExpose`, and **`handler`** (optional path to a .mjs that runs the API step; when omitted, the built-in http handler is used for that key).
- **Single source for OpenAPI**: All OpenAPI-derived flows are defined only under `handlers`. The flowId format is `handlerKey:operationKey` (e.g. `simple:get-users` for handler key `simple`), so the key and operation are unambiguous and no prefix/colon parsing is needed beyond splitting on the first colon.
- **BREAKING**: Remove top-level **`config.openapi`**. Existing configs that use `openapi` must be migrated to `handlers` with the same prefix as key and the same options (using `handler` instead of `override`; no `overrideStepType`).
- **convention-openapi**: Replace `override` and `overrideStepType` with a single **`stepType`** (the handler key). Generated steps use `type: stepType`.

## Capabilities

### New Capabilities

- **config-handlers-openapi**: Handlers may be either a string (module path) or an OpenAPI entry object. OpenAPI entries have required `specPath` and optional `baseUrl`, `operationFilter`, `paramExpose`, and `handler` (path to .mjs for the API step). FlowIds for OpenAPI flows are `${handlerKey}-${operationKey}`. Registry construction: for string values load the .mjs; for OpenAPI entries load `entry.handler` when present, otherwise register the built-in http handler under the handler key.

### Modified Capabilities

- **config-openapi**: Requirements change to remove the top-level `openapi` block. FlowId resolution and discover for OpenAPI flows SHALL use only `config.handlers` entries that are OpenAPI-shaped (object with `specPath`). Document migration: move each `openapi[prefix]` entry into `handlers[prefix]` with the same options, and use `handler` instead of `override` (drop `overrideStepType`).
- **workspace**: resolveFlowId and buildDiscoverCatalog SHALL derive OpenAPI flows only from `config.handlers` (entries that are objects with `specPath`). No reading of `config.openapi`. RunflowConfig SHALL no longer include `openapi`; it SHALL allow `handlers` values to be string or OpenApiHandlerEntry.

## Impact

- **packages/workspace**: Config types (RunflowConfig, new OpenApiHandlerEntry), resolveFlowId (only handlers), buildDiscoverCatalog (only handlers), tests.
- **packages/convention-openapi**: OpenApiToFlowsOptions (stepType; remove override/overrideStepType), operationToFlow, types, tests.
- **apps/cli**, **apps/mcp-server**: Registry construction: handle handler values that are objects (OpenAPI entries), load optional `entry.handler` .mjs or use built-in http; tests.
- **examples**: Update runflow.config.json to use handlers-only (OpenAPI under a handler key with optional `handler` path).
