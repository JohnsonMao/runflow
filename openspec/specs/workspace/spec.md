# workspace Specification

## Purpose

定義 **@runflow/workspace**（packages/workspace）的職責與對外介面：僅提供工作區「資料與解析」及 list/detail 的 Markdown 格式化，不負責誰載入 config、不負責執行 flow。CLI 與 MCP 依賴 workspace 取得 config、catalog、resolveFlow 與 list/detail 的 Markdown 輸出。

## Requirements

### Requirement: Workspace SHALL provide config discovery and loading

The workspace package SHALL export **findConfigFile(cwd)** and **loadConfig(path)**. findConfigFile SHALL return the first existing path among runflow.config.mjs, runflow.config.js, runflow.config.json under the given cwd, or null. loadConfig SHALL load and return the config object (RunflowConfig). RunflowConfig SHALL include an optional **params** property of type **ParamDeclaration[]** (array of param declarations), not Record<string, unknown>. When the config file contains `params` as a plain object (legacy), loadConfig MAY normalize it to ParamDeclaration[] for backward compatibility (see config-params-declaration spec). Config path resolution (e.g. from `--config` or cwd) is the responsibility of the caller (CLI or MCP); workspace does not read environment variables for config path.

#### Scenario: findConfigFile returns first existing config file in cwd

- **WHEN** the caller invokes findConfigFile(cwd) and runflow.config.mjs exists in cwd
- **THEN** the return value SHALL be the path to that file
- **AND** when only runflow.config.js or runflow.config.json exists, that path SHALL be returned instead (order: .mjs, .js, .json)

#### Scenario: loadConfig loads and returns RunflowConfig

- **WHEN** the caller invokes loadConfig(absolutePath) with a valid config file path
- **THEN** the return value SHALL be the config object (RunflowConfig) with optional flowsDir, openapi, handlers, params (params when present SHALL be ParamDeclaration[])
- **AND** paths inside the config are not resolved by workspace; the caller uses configDir (dirname of config path) for resolution

### Requirement: Workspace SHALL provide flowId resolution (resolveFlowId)

The workspace SHALL export **resolveFlowId(flowId, config, configDir, cwd)** returning **ResolvedFlow** (file path or openapi). Caller is responsible for loading the flow and building the registry; workspace does not execute flows.

#### Scenario: resolveFlowId returns file path for file-type flowId

- **WHEN** config has flowsDir (or cwd is used) and the caller invokes resolveFlowId(relativePath, config, configDir, cwd) with a path under flowsDir/cwd
- **THEN** the return value SHALL be ResolvedFlow of type file with resolved path
- **AND** OpenAPI-type flowIds (prefix-operation) SHALL be resolved using config.openapi[prefix] and return type openapi with specPath, operation, options

#### Scenario: resolveFlowId returns openapi for prefix-operation flowId

- **WHEN** config has openapi[prefix] and the caller invokes resolveFlowId('prefix-operation', config, configDir, cwd)
- **THEN** the return value SHALL be ResolvedFlow of type openapi with specPath, operation, and options from that prefix
- **AND** the caller MAY then load the flow via openApiToFlows(specPath, options)

### Requirement: Workspace SHALL provide discover catalog and entry lookup

The workspace SHALL export **findFlowFiles**, **buildDiscoverCatalog(config, configDir, cwd)**, and **getDiscoverEntry(catalog, flowId)**. buildDiscoverCatalog SHALL return **DiscoverEntry[]**. **DEFAULT_DISCOVER_LIMIT** and **MAX_DISCOVER_LIMIT** SHALL both be **10**. Caller applies keyword, limit, offset.

#### Scenario: getDiscoverEntry returns entry by flowId

- **WHEN** the caller has a catalog from buildDiscoverCatalog and invokes getDiscoverEntry(catalog, flowId)
- **THEN** if flowId exists in the catalog the return value SHALL be that DiscoverEntry
- **AND** if not found the return value SHALL be undefined (or equivalent)

#### Scenario: buildDiscoverCatalog returns file and OpenAPI flows

- **WHEN** config has flowsDir and openapi (at least one prefix), and the caller invokes buildDiscoverCatalog(config, configDir, cwd)
- **THEN** the returned array SHALL include entries for file flows (flowId = path relative to flowsDir or cwd) and for OpenAPI flows (flowId = prefix-operation)
- **AND** each entry SHALL have flowId, name, description (optional), params (optional, ParamDeclaration[])

### Requirement: Workspace SHALL provide list and detail Markdown formatting

The workspace SHALL export **formatListAsMarkdown(entries, limit, offset)** and **formatDetailAsMarkdown(entry)**. These SHALL produce the same Markdown text used by the CLI and MCP for discover_flow_list and discover_flow_detail (table with flowId | name; pagination hint when applicable; detail with flowId, name, description, params). CLI and MCP SHALL use these functions so that list/detail presentation is consistent and maintained in one place.

#### Scenario: formatListAsMarkdown produces table and pagination hint

- **WHEN** the caller invokes formatListAsMarkdown(entries, limit, offset) with non-empty entries and limit/offset
- **THEN** the return value SHALL be Markdown with a first line for total and range, a table with columns flowId | name, and when offset + limit < total a pagination hint line (e.g. "Next: offset=N")

#### Scenario: formatDetailAsMarkdown produces single-flow detail

- **WHEN** the caller invokes formatDetailAsMarkdown(entry)
- **THEN** the return value SHALL be Markdown that includes the flow's flowId, name, description, and params (path/query/body; body fields MAY be expanded)

### Requirement: Workspace SHALL provide createResolveFlow for core

The workspace SHALL export **createResolveFlow(config, configDir, cwd)** returning **ResolveFlowFn** (async flowId → flow or null) for @runflow/core run(flow, { resolveFlow }). Package SHALL depend on @runflow/core and @runflow/convention-openapi; SHALL NOT depend on CLI or MCP.

#### Scenario: createResolveFlow returns resolver used by core for flow steps

- **WHEN** the caller invokes createResolveFlow(config, configDir, cwd) and passes the result to run(flow, { resolveFlow })
- **THEN** when a flow step has type flow and a flowId string, core SHALL call resolveFlow(flowId) to obtain the callee flow
- **AND** the returned resolver SHALL use resolveFlowId and loadFromFile or openApiToFlows so nested flow steps resolve to workspace files or OpenAPI flows

## Non-requirements (out of scope)

- Workspace does not define how the registry is built (CLI and MCP build it from config.handlers only).
- Workspace does not define config path source (e.g. no RUNFLOW_CONFIG; caller uses --config or findConfigFile(cwd)).
- Workspace does not cache config or catalog; caching is the responsibility of the caller (e.g. MCP caches, CLI does not).
