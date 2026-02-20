# config-openapi Specification (delta)

本 delta：移除 hooks；新增 paramExpose、override；規定 validateRequest 所需資訊透過 context 傳遞。

## REMOVED Requirements

### Requirement: openapi per-prefix hooks (before/after)

The per-prefix value in the `openapi` object SHALL NOT include `hooks`. The implementation SHALL NOT support or accept `hooks` (before/after). Any existing references to hooks in config-openapi are removed.

#### Scenario: openapi options without hooks

- **WHEN** config has `openapi.myApi.specPath` and optionally `baseUrl`, `operationFilter`, `paramExpose`, `override`
- **THEN** the system SHALL call `openApiToFlows(specPath, options)` with no hooks in options
- **AND** the generated flow SHALL have a single API step (http or override type) with no before/after steps

## ADDED Requirements

### Requirement: openapi per-prefix MAY define paramExpose

For each prefix, the value MAY include `paramExpose` (object). When present, it SHALL control which param kinds are included in the generated flow's `params` array. Keys SHALL be `path`, `query`, `body`, `header`, `cookie`; each value SHALL be a boolean. When a key is omitted or true, that kind is **exposed** (included in flow.params); when false, that kind is **hidden** (excluded from flow.params). Default when `paramExpose` is omitted: path, query, body exposed; header, cookie hidden.

#### Scenario: default paramExpose

- **WHEN** `paramExpose` is not set for a prefix
- **THEN** the generated flow's params SHALL include only params with `in` in `{ path, query, body }`
- **AND** params with `in` in `{ header, cookie }` SHALL NOT appear in flow.params

#### Scenario: custom paramExpose

- **WHEN** config has `openapi.myApi.paramExpose: { path: true, query: true, body: true, header: false, cookie: false }` (or subset)
- **THEN** the generated flow's params SHALL include only params whose `in` has paramExpose[in] === true
- **AND** hidden params MAY still be supplied at runtime via context but SHALL NOT be in the flow's param declaration

### Requirement: openapi per-prefix MAY define override

For each prefix, the value MAY include `override` (string). When present, it SHALL denote either a **handler name** (key in config.handlers) or a **module path** (relative to config file directory or absolute). The generated flow for each operation SHALL use this as the step handler for the API step: the step's `type` SHALL be the handler's type, and the step payload SHALL match the http step shape (`url`, `method`, `headers`, `body`). The override module SHALL export the same interface as a custom handler: `{ validate(step), kill(), run(step, context) }`.

#### Scenario: override with handler name

- **WHEN** config has `openapi.myApi.override: "myApiHandler"` and `handlers.myApiHandler` is a path
- **THEN** when resolving a flow for `myApi-get-users`, the API step SHALL have type equal to the handler type (e.g. the registered type for that handler)
- **AND** the step SHALL have url, method, headers, body (template-ready)

#### Scenario: override receives same step shape as http

- **WHEN** the override handler's run(step, context) is invoked
- **THEN** step SHALL contain at least id, type, url, method, and optionally headers, body
- **AND** the executor SHALL have applied template substitution to step before invoking the handler

### Requirement: validateRequest info SHALL be passed via context

When the API step uses an override handler, the runner SHALL inject into **context** the information needed for the override to perform OpenAPI request validation. The context SHALL include `openApiSpecPath` (string, resolved spec file path) and `openApiOperationKey` (string, e.g. `get-users`). The override handler MAY read these from context and call a validateRequest(step, context) API (provided by convention-openapi) to validate the request against the operation's schema before sending; validation is optional and handler-defined.

#### Scenario: context has openApiSpecPath and openApiOperationKey

- **WHEN** an OpenAPI-derived flow is run and the API step uses an override handler
- **THEN** before the handler's run(step, context) is called, context SHALL contain `openApiSpecPath` and `openApiOperationKey`
- **AND** the override MAY use these to load the spec and validate step (e.g. body, params) against the operation's request schema
- **AND** if validation fails, the override SHALL return stepResult(step.id, false, { error: '...' })

#### Scenario: validateRequest via context (no step pollution)

- **WHEN** the generated API step is produced
- **THEN** the step object SHALL NOT be required to carry openApiSpecPath or openApiOperationKey
- **AND** those values SHALL only be provided at runtime via context when the step is executed
