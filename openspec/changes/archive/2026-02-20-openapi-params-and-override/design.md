# Design: OpenAPI params filter and override (no hooks)

## Context

Hooks (before/after) are unused and will be removed. We add (1) paramExpose to filter which param kinds appear in flow.params, (2) override as a single handler (custom-handler shape) that receives http-like step and can validate via OpenAPI using info from context. validateRequest-related data (openApiSpecPath, openApiOperationKey) are passed via context so the step payload stays clean and the override can optionally validate before sending.

## Goals / Non-Goals

**Goals:**
- Remove all hooks code and config; no before/after steps.
- Filter flow.params at generation time by paramExpose (default: path/query/body exposed, header/cookie hidden).
- Override: one handler per prefix (or per operation if we extend later), same interface as custom-handler; step shape = http (url, method, headers, body).
- Context injection: openApiSpecPath and openApiOperationKey in context when running override step; override may call validateRequest(step, context) from convention-openapi.
- Workspace format uses flow.params as-is (no hardcoded API_PARAM_INS filter).

**Non-Goals:**
- No change to core executor step invocation (context injection is done by the runner when building the initial context or by passing a context augment from resolver).
- No new step types in core; override is a registered handler type like any other.

## Decisions

### 1. Where to remove hooks

**Decision:** Remove from packages/convention-openapi: types (OperationHooks, HooksEntry, StepDef, hooks from OpenApiToFlowsOptions); resolveHooks.ts and applyHooks.ts (delete); openApiToFlows.ts (no hooks parameter, no applyHooks call). Remove from packages/workspace: config types and any mapping of hooks from config to options. Remove from openspec/specs/config-openapi main spec: all hooks requirements (done in main spec when syncing; this change's delta already states removal).

**Rationale:** Single place for OpenAPI→flow generation is convention-openapi; workspace only passes options through.

### 2. paramExpose shape and application

**Decision:** `paramExpose?: { path?: boolean, query?: boolean, body?: boolean, header?: boolean, cookie?: boolean }`. Omitted key or true = exposed; false = hidden. Default: path, query, body true; header, cookie false. Apply in openApiToFlows after mapParamsToDeclarations: filter declarations where `decl.in` is present and paramExpose[decl.in] !== false (treat omitted as true).

**Rationale:** Simple object; default matches current workspace format behavior so discover/format continue to show the same params when paramExpose is not set.

### 3. Override: handler name vs path

**Decision:** `override` is a string. If it matches a key in config.handlers, use that handler (already loaded/registered). Otherwise treat as a module path (relative to config dir or absolute), load like custom-handler (dynamic import), and register under a type. The generated step's type SHALL be that handler's type (e.g. the key used when registering). Step payload: url, method, headers (optional), body (optional), same as http step.

**Rationale:** Reuses existing handlers mechanism; path allows one-off override modules without adding to top-level handlers if desired.

### 4. Who injects openApiSpecPath and openApiOperationKey into context

**Decision:** The **runner** (CLI/MCP) that has access to "which flow and which operation" injects these into the **initial context** (params) when calling run(). So when createResolveFlow returns a ResolvedFlow for an OpenAPI flow, the runner knows flowId (e.g. simple-get-users), and can resolve prefix + operationKey. When building the options.params (initial context) for run(), the runner adds openApiSpecPath and openApiOperationKey to that context. Thus every step (including the override step) sees them in context.params. No executor change: executor just passes context through; the runner is responsible for augmenting initial context for OpenAPI flows.

**Rationale:** Executor stays agnostic; resolver already returns flow + flowFilePath but may not have spec path/operation key in a single place. Runner has flowId and config, so it can compute spec path and operation key and put them into options.params (or a dedicated context augment if we add one). Using options.params keeps implementation simple and avoids new executor APIs.

**Alternative considered:** Executor accepts a "contextAugment" in RunOptions that is merged into context before each step. Rejected for simplicity; params are already the initial context, so putting openApiSpecPath/openApiOperationKey there is sufficient.

### 5. validateRequest API

**Decision:** convention-openapi exports a function `validateRequest(step, context): { valid: boolean, error?: string }`. It reads context.openApiSpecPath and context.openApiOperationKey, loads the spec (or uses cache), gets the operation, and validates step (e.g. body against requestBody schema, path/query/header if desired). Override handler calls it inside run() and returns stepResult(false, { error }) if invalid. Implementation may use existing resolveSchema/mapParams logic or a small validator.

**Rationale:** Keeps validation logic in convention-openapi; override stays thin and reusable.

### 6. Workspace format

**Decision:** formatDetailAsMarkdown (and any list param display) SHALL use flow.params as returned by the flow definition without filtering by API_PARAM_INS. Remove the constant API_PARAM_INS and the filter in format.ts; if a flow has params with in: header/cookie (e.g. from an older generator or manual YAML), they will now be shown. For OpenAPI-generated flows, params will already be filtered by paramExpose at generation time.

**Rationale:** Single source of truth for "what params are visible" is the flow (and its generator); workspace only displays.

## Risks / Trade-offs

- **Runner must know OpenAPI flowId shape** to inject spec path and operation key. Mitigation: resolveFlowId already returns type and path; we need to also return or compute operationKey and specPath for OpenAPI flows so the runner can pass them into options.params. So createResolveFlow or loadFlow might need to expose openApiSpecPath and openApiOperationKey when the resolved flow is OpenAPI-derived (e.g. on ResolvedFlow or as a separate helper).
- **Context keys openApiSpecPath / openApiOperationKey** are reserved for OpenAPI override; if a flow uses those param names for something else, they could be overwritten. Mitigation: Document as reserved when running OpenAPI flows; use a namespaced key like openApi.specPath if we want to avoid clashes (this design uses flat keys for simplicity).

## Migration Plan

- Remove hooks from examples/config/runflow.config.json (delete the hooks array).
- No migration for paramExpose (additive, default preserves current behavior).
- Override is additive; no existing users of hooks to migrate.
