# Spec: config-handlers-openapi

## Purpose

Define how runflow config **handlers** can be either a module path (string) or an OpenAPI entry object. OpenAPI-derived flows use the handler key as the flowId prefix and as the step type; optional `handler` (path to .mjs) runs the API step, otherwise the built-in http handler is used.

## Requirements

### Requirement: Handlers MAY be a string or an OpenAPI entry object

The runflow config SHALL allow **handlers** to be a **Record<string, string | OpenApiHandlerEntry>**. A value that is a **string** SHALL denote a path to a step-handler module (.mjs), resolved relative to the config file directory. A value that is an **object** with a **specPath** property SHALL be treated as an **OpenAPI entry**. Any other value type SHALL be ignored by the implementation when building the registry or resolving OpenAPI flowIds.

#### Scenario: Handler value is a string

- **WHEN** config has `handlers.myType` set to a string (e.g. `"./my-handler.mjs"`)
- **THEN** the implementation SHALL resolve the path relative to the config file directory and SHALL load that module as the step handler for type `myType`
- **AND** the handler SHALL be registered under that type for flow execution

#### Scenario: Handler value is an OpenAPI entry object

- **WHEN** config has `handlers.api` set to an object with at least `specPath` (and optionally `baseUrl`, `operationFilter`, `paramExpose`, `handler`)
- **THEN** the implementation SHALL treat it as an OpenAPI entry for flowId prefix `api`
- **AND** flowIds of the form `api-<operationKey>` SHALL resolve to that spec and operation
- **AND** the generated API step SHALL have `type: "api"` (the handler key)

### Requirement: OpenAPI entry object shape

An **OpenApiHandlerEntry** SHALL have **specPath** (string, required). It MAY have **baseUrl** (string), **operationFilter** (object, same semantics as OpenApiToFlowsOptions), **paramExpose** (object, same semantics as OpenApiToFlowsOptions), and **handler** (string, path to a .mjs module that runs the API step). Paths SHALL be resolved relative to the config file directory when not absolute.

#### Scenario: OpenAPI entry with only specPath

- **WHEN** config has `handlers.simple` with `{ "specPath": "../openapi/spec.yaml" }` and no `handler`
- **THEN** flowIds like `simple:get-users` (handlerKey:operationKey) SHALL resolve to that spec and the given operation
- **AND** the implementation SHALL register the built-in http handler under the key `simple` for that step type

#### Scenario: OpenAPI entry with optional handler path

- **WHEN** config has `handlers.simple` with `specPath` and `"handler": "../custom-api.mjs"`
- **THEN** the implementation SHALL load that module and SHALL register it under the key `simple`
- **AND** the API step in generated flows SHALL have `type: "simple"` and SHALL be executed by that loaded handler (payload: url, method, headers, body)

### Requirement: FlowId for OpenAPI flows from handlers

OpenAPI-derived flowIds SHALL be **`${handlerKey}-${operationKey}`** where handlerKey is the key in handlers whose value is an OpenAPI entry, and operationKey is the operation key (e.g. `GET /users`). Resolution SHALL use the longest matching handler key when multiple keys could match, so that more specific prefixes take precedence.

#### Scenario: flowId resolves to OpenAPI flow from handler key

- **WHEN** config has `handlers.myApi` as an OpenAPI entry and the caller invokes resolveFlowId('myApi-get-users', config, configDir, cwd)
- **THEN** the return value SHALL be ResolvedFlow of type openapi with specPath (resolved), operation `get-users`, and options including stepType `myApi` and the entry's baseUrl, operationFilter, paramExpose
- **AND** the caller SHALL be able to load the flow via openApiToFlows(specPath, { stepType: 'myApi', ... })

### Requirement: Registry construction for handler entries

When building the step registry from config.handlers, the implementation SHALL iterate entries. For each **string** value: resolve path, load the module, register under the key. For each **OpenAPI entry** value: if **handler** is set, resolve and load that .mjs and register under the key; otherwise register the built-in http handler (from @runflow/handlers) under the key. The implementation SHALL skip or ignore entries whose value is neither a string nor an object with specPath.

#### Scenario: OpenAPI entry without handler uses built-in http

- **WHEN** config has an OpenAPI entry with no `handler` property
- **THEN** the registry SHALL have the built-in http handler registered under that handler key
- **AND** steps with that type SHALL execute with the same semantics as type `http` (url, method, headers, body)

#### Scenario: OpenAPI entry with handler loads custom module

- **WHEN** config has an OpenAPI entry with `handler` set to a valid .mjs path
- **THEN** the implementation SHALL load that module and SHALL register its default export under the handler key
- **AND** the module SHALL receive the same step shape (url, method, headers, body) and context as an override handler today
