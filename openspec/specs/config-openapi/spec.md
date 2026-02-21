# Spec: config-openapi

## Purpose

定義 runflow 設定檔與 OpenAPI 流程的關係：config 不支援頂層 `openapi` 區塊；OpenAPI 流程僅由 `config.handlers` 內之 OpenAPI 型別 entry 提供，flowId 為 `key-operationKey`。另可選 `flowsDir` 供 file-type flowId 解析。CLI 與 MCP 共用同一 config 語意。詳見 config-handlers-openapi spec。

## Requirements

### Requirement: Config file format and discovery

The runflow config SHALL be loaded from a file. The implementation SHALL discover config by looking for the first existing file in the current working directory (or from a path given by `--config`) in this order: **runflow.config.mjs**, **runflow.config.js**, **runflow.config.json**. When the file extension is **.json**, the file SHALL be valid JSON and the root object SHALL be the config (no `default` export). When the extension is **.mjs** or **.js**, the module SHALL export a default object (the config). Paths inside the config SHALL be resolved relative to the directory of the config file.

#### Scenario: Config discovered by file order in cwd

- **WHEN** the implementation looks for config in the current working directory
- **THEN** it SHALL use the first existing file among runflow.config.mjs, runflow.config.js, runflow.config.json in that order
- **AND** the loaded object SHALL be the config (JSON root or module default export)

#### Scenario: Paths in config resolved relative to config directory

- **WHEN** the config file contains relative paths (e.g. in handlers or flowsDir)
- **THEN** the implementation SHALL resolve them relative to the directory of the config file
- **AND** absolute paths SHALL be used as-is

### Requirement: No top-level openapi block; OpenAPI flows from handlers only

The runflow config SHALL NOT support a top-level **openapi** object. OpenAPI-derived flow resolution and discover SHALL use only **config.handlers** entries that are objects with **specPaths** (see config-handlers-openapi spec). FlowId format for OpenAPI flows SHALL be **`${handlerKey}-${operationKey}`** where handlerKey is the key in handlers whose value is an OpenApiHandlerEntry.

#### Scenario: Config without openapi block (unchanged behavior)

- **WHEN** config is loaded and has no `openapi` property
- **THEN** CLI and MCP SHALL resolve only file-type flowIds and OpenAPI flowIds from handlers (prefix-operation from config.handlers OpenAPI entries only)

#### Scenario: OpenAPI flows only from handlers

- **WHEN** config has no top-level `openapi` and has one or more handlers whose value is an object with `specPaths`
- **THEN** flowIds of the form `handlerKey-operationKey` SHALL be resolved from that handler entry (specPaths merged, then options)
- **AND** the same config SHALL be usable by both CLI and MCP

#### Scenario: specPaths and options only in handlers

- **WHEN** config has `handlers.myApi` as an OpenAPI entry with `specPaths` (array of strings) and optional `baseUrl`, `operationFilter`, `paramExpose`, `handler`
- **THEN** flowIds starting with `myApi-` SHALL be resolved using that entry's specPaths (loaded, merged into one OpenAPI document) and options
- **AND** the generated flow SHALL use stepType `myApi` and the entry's options when calling openApiToFlows on the merged spec

### Requirement: Config MAY define flowsDir

The runflow config MAY export a top-level `flowsDir` (string). When present, it SHALL denote the directory used to resolve **file-type flowIds** (relative paths). It SHALL be resolved relative to the config file directory when not absolute. The CLI and MCP SHALL use flowsDir as the base directory when resolving a flowId that is not absolute and does not match any handlers OpenAPI prefix-operation pattern.

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
