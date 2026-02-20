## 1. Config types and workspace config

- [x] 1.1 In packages/workspace define OpenApiHandlerEntry (specPath required; baseUrl, operationFilter, paramExpose, handler optional) and export it
- [x] 1.2 Change RunflowConfig.handlers to Record<string, string | OpenApiHandlerEntry> and remove RunflowConfig.openapi and OpenApiEntry
- [x] 1.3 Add helper isOpenApiHandlerEntry(entry): value is object and has specPath

## 2. convention-openapi stepType

- [x] 2.1 In OpenApiToFlowsOptions add stepType (string), remove override and overrideStepType from types and JSDoc
- [x] 2.2 In operationToFlow use options.stepType ?? 'http' for step.type; remove override/overrideStepType logic
- [x] 2.3 Update openApiToFlows to pass stepType into operationToFlow; update call sites and tests that used override/overrideStepType

## 3. resolveFlowId from handlers only

- [x] 3.1 In resolveFlowId remove all logic that reads config.openapi
- [x] 3.2 In resolveFlowId iterate config.handlers; for each OpenAPI entry (object with specPath), if flowId.startsWith(key + '-') and flowId.length > key.length + 1, set operation = flowId.slice(key.length + 1) and return ResolvedOpenApiFlow (specPath resolved from configDir, operation, options with stepType = key and entry's baseUrl, operationFilter, paramExpose)
- [x] 3.3 Use longest matching handler key when multiple keys match (e.g. api vs api-v2)
- [x] 3.4 ResolvedOpenApiFlow.options must include stepType and must not include override/overrideStepType

## 4. buildDiscoverCatalog from handlers only

- [x] 4.1 Remove the loop that builds catalog from config.openapi
- [x] 4.2 For each config.handlers entry that is OpenApiHandlerEntry, resolve specPath, call openApiToFlows(specPath, { output: 'memory', stepType: key, baseUrl, operationFilter, paramExpose }), and add DiscoverEntry for each flow with flowId key-operationKey
- [x] 4.3 Preserve existing file-flow discovery (findFlowFiles, loadFromFile) unchanged

## 5. createResolveFlow and loadFlow

- [x] 5.1 Ensure createResolveFlow and loadFlow pass stepType (handler key) in options to openApiToFlows when resolving OpenAPI flows (options already come from ResolvedOpenApiFlow)
- [x] 5.2 Remove any references to override or overrideStepType in workspace loadFlow/resolveFlow chain

## 6. CLI registry construction

- [x] 6.1 In buildRegistryFromConfig (or equivalent) iterate config.handlers; for string value resolve path and load .mjs as today; for OpenApiHandlerEntry skip loading a module for the key but later register either entry.handler module or http handler
- [x] 6.2 For OpenApiHandlerEntry: if entry.handler is set, resolve path (relative to config dir), load the .mjs, registry[key] = loaded handler; else registry[key] = built-in http handler from @runflow/handlers
- [x] 6.3 Ignore or skip handler values that are neither string nor object with specPath (e.g. invalid types)

## 7. MCP server registry construction

- [x] 7.1 Apply same registry logic as CLI: for handlers[key] string load .mjs; for OpenApiHandlerEntry load entry.handler .mjs or register http handler under key
- [x] 7.2 Ensure MCP loadConfigOnce (or equivalent) builds registry from updated handlers shape

## 8. Tests

- [x] 8.1 packages/workspace: add tests for loadConfig with handlers containing OpenAPI entries (with and without handler path); tests for resolveFlowId with only handlers (longest match, file fallback); tests for buildDiscoverCatalog with only handlers
- [x] 8.2 packages/convention-openapi: update tests to use stepType instead of override/overrideStepType; add or adjust tests for operationToFlow step type
- [x] 8.3 apps/cli: update tests that depend on config.openapi to use handlers OpenAPI entries; add test for registry with OpenAPI entry (no handler → http) and OpenAPI entry (with handler → custom)
- [x] 8.4 apps/mcp-server: same as CLI for config and registry; update executor_flow tests that use openapi flowIds to use handler-key flowIds
- [x] 8.5 Remove or rewrite any tests that assert config.openapi presence or openapi-based flowId resolution from openapi block

## 9. Examples and docs

- [x] 9.1 Update examples/config/runflow.config.json to use only handlers: move openapi.simple into handlers.simple (or desired key) with specPath, baseUrl, operationFilter, and handler path; remove top-level openapi
- [x] 9.2 Add BREAKING CHANGE note in changelog or README: config.openapi removed; migration steps (move openapi[prefix] to handlers[prefix], use handler instead of override, drop overrideStepType)
