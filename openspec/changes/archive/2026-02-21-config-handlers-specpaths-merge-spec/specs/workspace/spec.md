# Delta: workspace

## MODIFIED Requirements

### Requirement: Workspace SHALL provide flowId resolution (resolveFlowId)

The workspace SHALL export **resolveFlowId(flowId, config, configDir, cwd)** returning **ResolvedFlow** (file or openapi). OpenAPI-type flowIds SHALL be resolved only from **config.handlers**: for each key whose value is an object with **specPaths**, if flowId is of the form `${key}-${operation}` (operation non-empty), the result SHALL be ResolvedFlow of type openapi with **specPaths** (resolved array of absolute paths), **operation**, and **options** (including stepType = key and the entry's baseUrl, operationFilter, paramExpose). ResolvedFlow of type openapi SHALL NOT include specPath, openApiSpecPath, or openApiOperationKey. When multiple handler keys match, the longest matching key SHALL win. Caller is responsible for loading the flow (e.g. by merging specs from specPaths and calling openApiToFlows) and building the registry; workspace does not execute flows.

#### Scenario: resolveFlowId returns file path for file-type flowId

- **WHEN** config has flowsDir (or cwd is used) and the caller invokes resolveFlowId(relativePath, config, configDir, cwd) with a path that does not match any handlers OpenAPI prefix, or with a path under flowsDir/cwd
- **THEN** the return value SHALL be ResolvedFlow of type file with resolved path
- **AND** file-type flowIds SHALL NOT be resolved from config.openapi (no openapi block)
- **AND** file-type flow resolution SHALL use only flowsDir (or cwd when flowsDir is absent) as the base directory; no other path scope SHALL apply

#### Scenario: resolveFlowId returns openapi for handlerKey-operationKey flowId

- **WHEN** config has handlers[key] as an OpenAPI entry (object with specPaths) and the caller invokes resolveFlowId('key-operation', config, configDir, cwd)
- **THEN** the return value SHALL be ResolvedFlow of type openapi with specPaths (resolved array), operation, and options (stepType = key, baseUrl, operationFilter, paramExpose from that entry)
- **AND** the return value SHALL NOT contain specPath, openApiSpecPath, or openApiOperationKey
- **AND** the caller MAY then load the flow by merging the specs at specPaths and calling openApiToFlows(mergedSpec, { stepType: key, ... })

### Requirement: Workspace SHALL provide discover catalog and entry lookup

The workspace SHALL export **findFlowFiles**, **buildDiscoverCatalog(config, configDir, cwd)**, and **getDiscoverEntry(catalog, flowId)**. buildDiscoverCatalog SHALL return **DiscoverEntry[]**. OpenAPI-derived entries SHALL be produced only from **config.handlers**: for each key whose value is an OpenAPI entry (object with **specPaths**), the implementation SHALL merge the specs at specPaths, call openApiToFlows on the merged result, and SHALL add entries with flowId `key-operationKey`. buildDiscoverCatalog SHALL NOT read or use a top-level config.openapi. **DEFAULT_DISCOVER_LIMIT** and **MAX_DISCOVER_LIMIT** SHALL both be **10**. Caller applies keyword, limit, offset. File flows SHALL be discovered only from the **flowsDir** (or cwd when flowsDir is absent); no other directory SHALL be used for file flow scope.

#### Scenario: getDiscoverEntry returns entry by flowId

- **WHEN** the caller has a catalog from buildDiscoverCatalog and invokes getDiscoverEntry(catalog, flowId)
- **THEN** if flowId exists in the catalog the return value SHALL be that DiscoverEntry
- **AND** if not found the return value SHALL be undefined (or equivalent)

#### Scenario: buildDiscoverCatalog returns file and OpenAPI flows from handlers only

- **WHEN** config has flowsDir and at least one handlers entry that is an OpenAPI entry (object with specPaths), and the caller invokes buildDiscoverCatalog(config, configDir, cwd)
- **THEN** the returned array SHALL include entries for file flows (flowId = path relative to flowsDir or cwd) and for OpenAPI flows (flowId = handlerKey-operationKey) derived only from handlers (merged spec per entry)
- **AND** each entry SHALL have flowId, name, description (optional), params (optional, ParamDeclaration[])
- **AND** the implementation SHALL NOT include entries from any top-level config.openapi

### Requirement: Workspace SHALL provide createResolveFlow for core

The workspace SHALL export **createResolveFlow(config, configDir, cwd)** returning **ResolveFlowFn** (async flowId → **{ flow }** or null) for @runflow/core run(flow, { resolveFlow }). The resolver SHALL return an object with only **flow** (FlowDefinition); it SHALL NOT return flowFilePath, openApiContext, specPath, path, or openApiSpecPath/openApiOperationKey. Package SHALL depend on @runflow/core and @runflow/convention-openapi; SHALL NOT depend on CLI or MCP.

#### Scenario: createResolveFlow returns resolver used by core for flow steps

- **WHEN** the caller invokes createResolveFlow(config, configDir, cwd) and passes the result to run(flow, { resolveFlow })
- **THEN** when a flow step has type flow and a flowId string, core SHALL call resolveFlow(flowId) to obtain the callee flow
- **AND** the returned resolver SHALL return only **{ flow: FlowDefinition }** or null; SHALL NOT attach flowFilePath or openApiContext to the result
- **AND** the resolver SHALL use resolveFlowId and, for openapi, merge specs from specPaths then openApiToFlows; for file, loadFromFile from the resolved path

## ADDED Requirements

### Requirement: LoadedFlow and resolveAndLoadFlow return only flow

When the workspace exports **resolveAndLoadFlow** or when load is used after resolve, the loaded result SHALL be an object with only **flow** (FlowDefinition). It SHALL NOT include flowFilePath, openApiContext, specPath, path, openApiSpecPath, or openApiOperationKey. Runners (CLI, MCP) and step handlers SHALL receive only the flow when resolving or loading a flow; no spec or file path metadata SHALL be passed for validation or override use.

#### Scenario: resolveAndLoadFlow returns only flow

- **WHEN** the caller invokes resolveAndLoadFlow(flowId, config, configDir, cwd)
- **THEN** the return value SHALL be an object **{ flow: FlowDefinition }**
- **AND** the return value SHALL NOT have flowFilePath or openApiContext

#### Scenario: createResolveFlow(flowId) returns only { flow } or null

- **WHEN** the resolver returned by createResolveFlow is invoked with a valid flowId
- **THEN** the resolved result SHALL be **{ flow }** or null
- **AND** the result SHALL NOT contain flowFilePath, openApiContext, specPath, or path
