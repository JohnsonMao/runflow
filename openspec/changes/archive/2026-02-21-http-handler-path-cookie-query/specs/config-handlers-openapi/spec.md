# Spec: config-handlers-openapi (delta)

## ADDED Requirements

### Requirement: Built-in http step shape MAY include path, query, and cookie

The step shape for the built-in http handler and for handlers registered for OpenAPI entries SHALL support optional **path**, **query**, and **cookie** in addition to url, method, headers, and body. When present, the built-in http handler SHALL use them as follows. **path** (string): SHALL replace the pathname of the request URL; the final URL SHALL be built from step.url's origin (protocol, host, port) plus this path. **query** (string or Record<string, string>): when a string, SHALL be used as the URL search part (without leading `?`); when an object, SHALL be serialized to application/x-www-form-urlencoded and used as the search part. **cookie** (string or Record<string, string>): SHALL set or override the Cookie request header; when an object, SHALL be serialized as key=value pairs separated by `; `. When both step.headers['Cookie'] and step.cookie are present, step.cookie SHALL take precedence for the Cookie header.

#### Scenario: Request URL pathname uses path when provided

- **WHEN** a step has url `https://api.example.com` and path `/users/123`
- **THEN** the built-in http handler SHALL request `https://api.example.com/users/123`

#### Scenario: Request URL search uses query when provided

- **WHEN** a step has url `https://api.example.com/search` and query `{ "q": "x", "limit": "10" }`
- **THEN** the built-in http handler SHALL request a URL whose search part encodes q=x and limit=10 (application/x-www-form-urlencoded or equivalent)

#### Scenario: Cookie header is set from cookie field

- **WHEN** a step has cookie as string `session=abc` or as object `{ "session": "abc" }`
- **THEN** the request SHALL include a Cookie header with that value; if step.headers also sets Cookie, step.cookie SHALL take precedence

## MODIFIED Requirements

### Requirement: OpenAPI entry object shape

An **OpenApiHandlerEntry** SHALL have **specPaths** (array of strings, required). Each element SHALL be a path to an OpenAPI spec file (YAML or JSON). It MAY have **baseUrl** (string), **operationFilter** (object, same semantics as OpenApiToFlowsOptions), **paramExpose** (object, same semantics as OpenApiToFlowsOptions), and **handler** (string, path to a .mjs module that runs the API step). Paths SHALL be resolved relative to the config file directory when not absolute. The implementation SHALL load each spec file, convert to JSON if needed, merge them into a single OpenAPI document, and SHALL use that merged document for openApiToFlows so that one entry yields one step type and one set of operations.

#### Scenario: OpenAPI entry with only specPaths

- **WHEN** config has `handlers.simple` with `{ "specPaths": ["../openapi/spec.yaml"] }` and no `handler`
- **THEN** flowIds like `simple-get-users` (handlerKey-operationKey) SHALL resolve to the merged spec (single file in this case) and the given operation
- **AND** the implementation SHALL register the built-in http handler under the key `simple` for that step type

#### Scenario: OpenAPI entry with multiple specPaths

- **WHEN** config has `handlers.scm` with `{ "specPaths": ["../openapi/repos.yaml", "../openapi/commits.yaml"] }`
- **THEN** the implementation SHALL load both files, merge into one OpenAPI document, and SHALL call openApiToFlows on that merged result
- **AND** flowIds of the form `scm-<operationKey>` SHALL resolve to operations from the merged spec
- **AND** the API step SHALL have `type: "scm"`

#### Scenario: OpenAPI entry with optional handler path

- **WHEN** config has `handlers.simple` with `specPaths` and `"handler": "../custom-api.mjs"`
- **THEN** the implementation SHALL load that module and SHALL register it under the key `simple`
- **AND** the API step in generated flows SHALL have `type: "simple"` and SHALL be executed by that loaded handler (payload: url, method, headers, body, and optionally path, query, cookie)

### Requirement: Registry construction for handler entries

When building the step registry from config.handlers, the implementation SHALL iterate entries. For each **string** value: resolve path, load the module, register under the key. For each **OpenAPI entry** value (object with **specPaths**): if **handler** is set, resolve and load that .mjs and register under the key; otherwise register the built-in http handler (from @runflow/handlers) under the key. The implementation SHALL skip or ignore entries whose value is neither a string nor an object with specPaths.

#### Scenario: OpenAPI entry without handler uses built-in http

- **WHEN** config has an OpenAPI entry (with specPaths) with no `handler` property
- **THEN** the registry SHALL have the built-in http handler registered under that handler key
- **AND** steps with that type SHALL execute with the same semantics as type `http` (url, method, headers, body, and optionally path, query, cookie)

#### Scenario: OpenAPI entry with handler loads custom module

- **WHEN** config has an OpenAPI entry with `specPaths` and `handler` set to a valid .mjs path
- **THEN** the implementation SHALL load that module and SHALL register its default export under the handler key
- **AND** the module SHALL receive the same step shape (url, method, headers, body, and optionally path, query, cookie) and context as an override handler today
