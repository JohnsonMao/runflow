## Context

Runflow config currently has two separate areas: `handlers` (Record of type → module path) and `openapi` (Record of prefix → OpenApiEntry with specPath, baseUrl, override, overrideStepType). FlowId resolution and discover read from `config.openapi` for prefix-operation flowIds; the registry is built only from `config.handlers` (string values). Unifying so that OpenAPI is just one shape of handler entry reduces duplication and makes the handler key the single source of truth for step type.

## Goals / Non-Goals

**Goals:**

- One config surface: `handlers` only. Values are either a string (module path) or an OpenAPI entry object (specPath + optional baseUrl, operationFilter, paramExpose, handler).
- FlowId for OpenAPI flows remains `key-operationKey` where key is the handler key; resolveFlowId and buildDiscoverCatalog derive these only from handlers (no top-level openapi).
- Registry: for OpenAPI entries, register either the module at `entry.handler` (when set) or the built-in http handler under the handler key.
- convention-openapi: accept `stepType` (handler key) only; remove override and overrideStepType.

**Non-Goals:**

- Hooks / before-after data passing for OpenAPI steps (out of scope).
- Backward compatibility with `config.openapi` (explicit breaking change).

## Decisions

1. **OpenAPI entry shape in handlers**  
   Use an object with required `specPath` and optional `baseUrl`, `operationFilter`, `paramExpose`, and `handler` (path to .mjs). Detection: value is object and has `specPath`. Rationale: minimal shape; `handler` clearly names “execution module” and avoids overloading “override”.

2. **resolveFlowId with only handlers**  
   resolveFlowId cannot know operation keys without loading the spec. So: iterate `config.handlers`; for each entry that is an object with `specPath`, resolve specPath (relative to configDir), call openApiToFlows(specPath, { output: 'memory', ... }) to get the operation list, then check if flowId === `${key}-${operationKey}` for any operation. First match wins. Longest-prefix match is not strictly necessary if handler keys are disjoint; we can use first match or longest key match for consistency with previous prefix behavior. Alternative: cache operation keys per handler key at config load time (heavier). Chosen: resolve on demand in resolveFlowId (no cache in workspace); call openApiToFlows when matching so we have operation keys. That implies sync or async: resolveFlowId is currently sync; openApiToFlows is async. So we need an async resolveFlowId or a different strategy. Checking workspace: resolveFlowId is sync and returns ResolvedFlow; the actual loading (openApiToFlows) happens in createResolveFlow / loadFlow. So for “openapi” type we only need to know (handlerKey, operationKey) from flowId. So we can parse flowId as `key-operationKey` by iterating handler keys and checking flowId.startsWith(key + '-'); then operation = flowId.slice(key.length + 1). We don’t need to validate that operation exists until load time. So resolveFlowId can stay sync: for each handler key whose value is OpenAPI entry, if flowId.startsWith(`${key}-`) and flowId.length > key.length + 1, then operation = flowId.slice(key.length + 1) and return ResolvedOpenApiFlow. We don’t need openApiToFlows in resolveFlowId. Good.

3. **Registry for OpenAPI handler keys**  
   When building the registry, for each handlers[key] that is an OpenAPI object: if entry.handler is set, resolve path (relative to config dir), load the .mjs, registry[key] = that handler; else registry[key] = built-in http handler (from @runflow/handlers). Same behavior as today for override: step payload is url, method, headers, body.

4. **convention-openapi API**  
   OpenApiToFlowsOptions: add `stepType: string` (required when generating steps that are not default http), remove `override` and `overrideStepType`. operationToFlow(..., options): step.type = options.stepType ?? 'http'. Callers (workspace when calling openApiToFlows for a handler key) always pass stepType = handler key.

5. **Migration**  
   No compatibility period. Remove `RunflowConfig.openapi` and `OpenApiEntry`. Docs/changelog: migrate by moving each `openapi[prefix]` into `handlers[prefix]` with the same specPath, baseUrl, operationFilter, paramExpose, and set `handler` to the previous `override` value (if any); drop overrideStepType.

## Risks / Trade-offs

- **resolveFlowId ambiguity**: If two handler keys are prefixes of each other (e.g. `api` and `api-v2`), flowId `api-v2-get-x` could match either. Mitigation: document that handler keys should not be prefixes of one another, or use longest-match in resolveFlowId (iterate and keep best match with longest key).
- **Sync resolveFlowId**: We keep it sync by deriving (key, operation) from flowId string only; we don’t validate operation exists until load. So invalid operation key will fail at load time with a clear “operation not found” style error.
- **Breaking change**: All users with config.openapi must migrate. Mitigation: changelog and migration snippet in docs.
