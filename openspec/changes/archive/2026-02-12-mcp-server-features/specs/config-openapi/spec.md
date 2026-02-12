# config-openapi Specification (delta)

## MODIFIED Requirements

### Requirement: Config MAY define an openapi block (prefix-keyed)

The runflow config (e.g. `runflow.config.mjs`, `runflow.config.js`, or `runflow.config.json`) MAY export (or, for JSON, contain at root) an `openapi` object. When present, it SHALL be a **Record keyed by prefix** (string). Each key is a prefix; each value SHALL be an object with at least `specPath` (string) and MAY include `hooks`, `baseUrl`, `operationFilter` with the same semantics as `OpenApiToFlowsOptions`. Paths (e.g. `specPath`) SHALL be resolved relative to the directory of the config file when not absolute. The flowId for an OpenAPI-derived flow SHALL be **`${prefix}-${operationKey}`** (e.g. `my-api-get-users`). The CLI and MCP SHALL use this structure to resolve flowIds of the form `prefix-operation` to the corresponding spec and operation.

#### Scenario: Config without openapi block

- **WHEN** config is loaded and has no `openapi` property
- **THEN** CLI and MCP SHALL resolve only file-type flowIds (no prefix-operation resolution)

#### Scenario: Config with openapi block (prefix-keyed)

- **WHEN** config is loaded and has an `openapi` object with at least one prefix key, each value having `specPath` and optionally `hooks`, `baseUrl`, `operationFilter`
- **THEN** when the user or client provides a flowId of the form `prefix-operation`, the system SHALL resolve the spec from `openapi[prefix].specPath`, load flows via `openApiToFlows` with the per-prefix options, and select the flow for the given operation key
- **AND** the same config SHALL be usable by both CLI and MCP for consistent flowId semantics

### Requirement: openapi per-prefix specPath and options

For each prefix in the `openapi` object, the value SHALL include `specPath` (string), the path to the OpenAPI spec file (relative to config directory or absolute). The value MAY include `hooks`, `baseUrl`, and `operationFilter` with the same semantics as `OpenApiToFlowsOptions`. The value MAY include `outDir` (string) for that prefix when writing generated flows to disk. **hooks** MAY be a Record (operation key → { before, after }) or an array of `{ pattern, hooks }`; when `pattern` is a string containing regex metacharacters (e.g. `^`, `$`), it SHALL be used as a RegExp source so that JSON config can express regex patterns (e.g. `"^get-"`).

#### Scenario: specPath resolved per prefix

- **WHEN** config has `openapi.myApi.specPath` set to a path (relative or absolute)
- **THEN** flowIds starting with `myApi-` SHALL be resolved using that spec file (resolved from config directory when relative)
- **AND** the operation key SHALL be the suffix after `myApi-` (e.g. `get-users`)

#### Scenario: hooks and baseUrl per prefix

- **WHEN** config has `openapi.myApi.hooks` or `openapi.myApi.baseUrl`
- **THEN** when resolving a flow for flowId `myApi-get-users`, the system SHALL call `openApiToFlows(specPath, { hooks, baseUrl, ... })` with that prefix's options
- **AND** the generated flow SHALL reflect those options (e.g. base URL for HTTP steps)

## ADDED Requirements

### Requirement: Config MAY define flowsDir

The runflow config MAY export a top-level `flowsDir` (string). When present, it SHALL denote the directory used to resolve **file-type flowIds** (relative paths). It SHALL be resolved relative to the config file directory when not absolute. The CLI and MCP SHALL use flowsDir as the base directory when resolving a flowId that is not absolute and does not match any openapi prefix-operation pattern.

#### Scenario: flowsDir used for file flowId resolution

- **WHEN** config has `flowsDir: "flows"` and the config file is at `/project/runflow.config.mjs` (or .js / .json)
- **THEN** a file flowId `hello.yaml` SHALL resolve to `/project/flows/hello.yaml`
- **AND** the same SHALL apply for CLI and MCP so that both use the same root for flow files

#### Scenario: No flowsDir

- **WHEN** config has no `flowsDir` or it is omitted
- **THEN** file-type flowIds SHALL be resolved relative to the current working directory (CLI) or server working directory (MCP)

## REMOVED Requirements

### Requirement: openapi as single block with specPath/outDir at top level

**Reason**: Replaced by prefix-keyed `openapi` structure so that multiple OpenAPI specs can be configured and referred to by flowId as `prefix-operation`.

**Migration**: Move each spec into a prefix key, e.g. `openapi: { specPath, outDir }` becomes `openapi: { myApi: { specPath, outDir } }`. Use flowId `myApi-get-users` instead of passing `--from-openapi` and `--operation get-users` separately.
