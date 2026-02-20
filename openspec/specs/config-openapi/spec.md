# Spec: config-openapi

## Purpose

定義 runflow 設定檔中 OpenAPI 區塊的格式與行為：config 可選的 `openapi` 物件為 prefix-keyed，提供多組 spec 與 flowId 解析（`prefix-operation`）；另可選 `flowsDir` 供 file-type flowId 解析。CLI 與 MCP 共用同一 config 語意。

## Requirements

### Requirement: Config file format and discovery

The runflow config SHALL be loaded from a file. The implementation SHALL discover config by looking for the first existing file in the current working directory (or from a path given by `--config`) in this order: **runflow.config.mjs**, **runflow.config.js**, **runflow.config.json**. When the file extension is **.json**, the file SHALL be valid JSON and the root object SHALL be the config (no `default` export). When the extension is **.mjs** or **.js**, the module SHALL export a default object (the config). Paths inside the config SHALL be resolved relative to the directory of the config file.

#### Scenario: Config discovered by file order in cwd

- **WHEN** the implementation looks for config in the current working directory
- **THEN** it SHALL use the first existing file among runflow.config.mjs, runflow.config.js, runflow.config.json in that order
- **AND** the loaded object SHALL be the config (JSON root or module default export)

#### Scenario: Paths in config resolved relative to config directory

- **WHEN** the config file contains relative paths (e.g. in openapi or flowsDir)
- **THEN** the implementation SHALL resolve them relative to the directory of the config file
- **AND** absolute paths SHALL be used as-is

### Requirement: Config MAY define an openapi block (prefix-keyed)

The runflow config (e.g. `runflow.config.mjs`, `runflow.config.js`, or `runflow.config.json`) MAY export (or, for JSON, contain at root) an `openapi` object. When present, it SHALL be a **Record keyed by prefix** (string). Each key is a prefix; each value SHALL be an object with at least `specPath` (string) and MAY include `baseUrl`, `operationFilter`, `paramExpose`, `override`, `overrideStepType` with the same semantics as `OpenApiToFlowsOptions`. Paths (e.g. `specPath`) SHALL be resolved relative to the directory of the config file when not absolute. The flowId for an OpenAPI-derived flow SHALL be **`${prefix}-${operationKey}`** (e.g. `my-api-get-users`). The CLI and MCP SHALL use this structure to resolve flowIds of the form `prefix-operation` to the corresponding spec and operation.

#### Scenario: Config without openapi block

- **WHEN** config is loaded and has no `openapi` property
- **THEN** CLI and MCP SHALL resolve only file-type flowIds (no prefix-operation resolution)

#### Scenario: Config with openapi block (prefix-keyed)

- **WHEN** config is loaded and has an `openapi` object with at least one prefix key, each value having `specPath` and optionally `baseUrl`, `operationFilter`, `paramExpose`, `override`
- **THEN** when the user or client provides a flowId of the form `prefix-operation`, the system SHALL resolve the spec from `openapi[prefix].specPath`, load flows via `openApiToFlows` with the per-prefix options, and select the flow for the given operation key
- **AND** the same config SHALL be usable by both CLI and MCP for consistent flowId semantics

### Requirement: openapi per-prefix specPath and options

For each prefix in the `openapi` object, the value SHALL include `specPath` (string), the path to the OpenAPI spec file (relative to config directory or absolute). The value MAY include `baseUrl`, `operationFilter`, `paramExpose`, `override`, and `overrideStepType` with the same semantics as `OpenApiToFlowsOptions`. The value MAY include `outDir` (string) for that prefix when writing generated flows to disk. **paramExpose** controls which param kinds (path, query, body, header, cookie) appear in flow.params; default is path/query/body exposed, header/cookie hidden. **override** (string) denotes a handler name or module path; when set, the API step uses that handler with http-like payload (url, method, headers, body). validateRequest info (openApiSpecPath, openApiOperationKey) SHALL be passed via context at runtime so the override can validate the request against the OpenAPI spec.

#### Scenario: specPath resolved per prefix

- **WHEN** config has `openapi.myApi.specPath` set to a path (relative or absolute)
- **THEN** flowIds starting with `myApi-` SHALL be resolved using that spec file (resolved from config directory when relative)
- **AND** the operation key SHALL be the suffix after `myApi-` (e.g. `get-users`)

#### Scenario: baseUrl, paramExpose, override per prefix

- **WHEN** config has `openapi.myApi.baseUrl`, `openapi.myApi.paramExpose`, or `openapi.myApi.override`
- **THEN** when resolving a flow for flowId `myApi-get-users`, the system SHALL call `openApiToFlows(specPath, { baseUrl, paramExpose, override, ... })` with that prefix's options
- **AND** the generated flow SHALL reflect those options (e.g. base URL for HTTP steps; params filtered by paramExpose; API step type from override when set)

### Requirement: Config MAY define flowsDir

The runflow config MAY export a top-level `flowsDir` (string). When present, it SHALL denote the directory used to resolve **file-type flowIds** (relative paths). It SHALL be resolved relative to the config file directory when not absolute. The CLI and MCP SHALL use flowsDir as the base directory when resolving a flowId that is not absolute and does not match any openapi prefix-operation pattern.

#### Scenario: flowsDir used for file flowId resolution

- **WHEN** config has `flowsDir: "flows"` and the config file is at `/project/runflow.config.mjs` (or .js / .json)
- **THEN** a file flowId `hello.yaml` SHALL resolve to `/project/flows/hello.yaml`
- **AND** the same SHALL apply for CLI and MCP so that both use the same root for flow files

#### Scenario: No flowsDir

- **WHEN** config has no `flowsDir` or it is omitted
- **THEN** file-type flowIds SHALL be resolved relative to the current working directory (CLI) or server working directory (MCP)

### Requirement: Config MAY define global default params

The runflow config MAY export (or, for JSON, contain at root) a `params` object (key-value map). When present, runners (CLI and MCP) SHALL merge it as default parameters for every flow run: effective params SHALL be `{ ...config.params, ...callerParams }` so that caller-supplied params override config params for the same key. Flows need not declare these keys in their `params` array; the engine SHALL pass through unknown keys to the flow context so that global params are available in steps (e.g. `params.apiBase`).

#### Scenario: Global params merged when config has params

- **WHEN** config is loaded with a `params` object (e.g. `{ "apiBase": "https://api.example.com" }`) and the user runs a flow (via CLI or MCP)
- **THEN** the runner SHALL pass to the engine an effective params object that includes config.params and any caller-provided params, with caller values overriding config for the same key
- **AND** the flow's step context SHALL receive the merged params so that steps can reference global keys without declaring them in the flow YAML

#### Scenario: Caller params override config params

- **WHEN** config has `params: { "token": "default" }` and the caller supplies `params: { "token": "override" }`
- **THEN** the effective params passed to the flow SHALL include `token: "override"`
- **AND** keys present only in config.params SHALL still be included in the flow context
