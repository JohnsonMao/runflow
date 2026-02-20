# workspace Specification (delta)

本 delta：RunflowConfig 移除 openapi；resolveFlowId 與 buildDiscoverCatalog 僅自 config.handlers 取得 OpenAPI 流程；handlers 值可為 string 或 OpenApiHandlerEntry。

## MODIFIED Requirements

### Requirement: Workspace SHALL provide config discovery and loading

The workspace package SHALL export **findConfigFile(cwd)** and **loadConfig(path)**. findConfigFile SHALL return the first existing path among runflow.config.mjs, runflow.config.js, runflow.config.json under the given cwd, or null. loadConfig SHALL load and return the config object (RunflowConfig). RunflowConfig SHALL include an optional **params** property of type **ParamDeclaration[]** (array of param declarations), not Record<string, unknown>. RunflowConfig SHALL include an optional **handlers** property of type **Record<string, string | OpenApiHandlerEntry>** (see config-handlers-openapi). RunflowConfig SHALL NOT include a top-level **openapi** property. When the config file contains `params` as a plain object (legacy), loadConfig MAY normalize it to ParamDeclaration[] for backward compatibility (see config-params-declaration spec). Config path resolution (e.g. from `--config` or cwd) is the responsibility of the caller (CLI or MCP); workspace does not read environment variables for config path.

#### Scenario: findConfigFile returns first existing config file in cwd

- **WHEN** the caller invokes findConfigFile(cwd) and runflow.config.mjs exists in cwd
- **THEN** the return value SHALL be the path to that file
- **AND** when only runflow.config.js or runflow.config.json exists, that path SHALL be returned instead (order: .mjs, .js, .json)

#### Scenario: loadConfig loads and returns RunflowConfig

- **WHEN** the caller invokes loadConfig(absolutePath) with a valid config file path
- **THEN** the return value SHALL be the config object (RunflowConfig) with optional flowsDir, handlers (string or OpenApiHandlerEntry per key), params (params when present SHALL be ParamDeclaration[])
- **AND** RunflowConfig SHALL NOT have an openapi property
- **AND** paths inside the config are not resolved by workspace; the caller uses configDir (dirname of config path) for resolution

### Requirement: Workspace SHALL provide flowId resolution (resolveFlowId)

The workspace SHALL export **resolveFlowId(flowId, config, configDir, cwd)** returning **ResolvedFlow** (file path or openapi). OpenAPI-type flowIds SHALL be resolved only from **config.handlers**: for each key whose value is an object with **specPath**, if flowId is of the form `${key}-${operation}` (operation non-empty), the result SHALL be ResolvedFlow of type openapi with specPath (resolved from configDir), operation, and options (including stepType = key and the entry's baseUrl, operationFilter, paramExpose). When multiple handler keys match, the longest matching key SHALL win. Caller is responsible for loading the flow and building the registry; workspace does not execute flows.

#### Scenario: resolveFlowId returns file path for file-type flowId

- **WHEN** config has flowsDir (or cwd is used) and the caller invokes resolveFlowId(relativePath, config, configDir, cwd) with a path that does not match any handlers OpenAPI prefix, or with a path under flowsDir/cwd
- **THEN** the return value SHALL be ResolvedFlow of type file with resolved path
- **AND** file-type flowIds SHALL NOT be resolved from config.openapi (no openapi block)

#### Scenario: resolveFlowId returns openapi for handlerKey:operationKey flowId

- **WHEN** config has handlers[key] as an OpenAPI entry (object with specPath) and the caller invokes resolveFlowId('key-operation', config, configDir, cwd)
- **THEN** the return value SHALL be ResolvedFlow of type openapi with specPath (resolved), operation, and options (stepType = key, baseUrl, operationFilter, paramExpose from that entry)
- **AND** the caller MAY then load the flow via openApiToFlows(specPath, { stepType: key, ... })

### Requirement: Workspace SHALL provide discover catalog and entry lookup

The workspace SHALL export **findFlowFiles**, **buildDiscoverCatalog(config, configDir, cwd)**, and **getDiscoverEntry(catalog, flowId)**. buildDiscoverCatalog SHALL return **DiscoverEntry[]**. OpenAPI-derived entries SHALL be produced only from **config.handlers**: for each key whose value is an OpenAPI entry (object with specPath), the implementation SHALL call openApiToFlows for that entry and SHALL add entries with flowId `key-operationKey`. buildDiscoverCatalog SHALL NOT read or use a top-level config.openapi. **DEFAULT_DISCOVER_LIMIT** and **MAX_DISCOVER_LIMIT** SHALL both be **10**. Caller applies keyword, limit, offset.

#### Scenario: getDiscoverEntry returns entry by flowId

- **WHEN** the caller has a catalog from buildDiscoverCatalog and invokes getDiscoverEntry(catalog, flowId)
- **THEN** if flowId exists in the catalog the return value SHALL be that DiscoverEntry
- **AND** if not found the return value SHALL be undefined (or equivalent)

#### Scenario: buildDiscoverCatalog returns file and OpenAPI flows from handlers only

- **WHEN** config has flowsDir and at least one handlers entry that is an OpenAPI entry (object with specPath), and the caller invokes buildDiscoverCatalog(config, configDir, cwd)
- **THEN** the returned array SHALL include entries for file flows (flowId = path relative to flowsDir or cwd) and for OpenAPI flows (flowId = handlerKey:operationKey) derived only from handlers
- **AND** each entry SHALL have flowId, name, description (optional), params (optional, ParamDeclaration[])
- **AND** the implementation SHALL NOT include entries from any top-level config.openapi
