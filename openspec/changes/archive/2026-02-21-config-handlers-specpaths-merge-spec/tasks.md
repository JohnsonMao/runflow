## 1. packages/workspace – types and merge

- [x] 1.1 Change OpenApiHandlerEntry from specPath to specPaths (string[]) in config types; remove specPath from type and isOpenApiHandlerEntry
- [x] 1.2 Add mergeOpenApiSpecs(specPaths: string[], configDir: string): Promise<OpenApiDocument> (load each path, parse YAML/JSON, merge into one OpenAPI object)
- [x] 1.3 ResolvedFlow openapi: use specPaths (string[]), operation, options only; remove specPath, openApiSpecPath, openApiOperationKey
- [x] 1.4 LoadedFlow type: only { flow }; remove flowFilePath and openApiContext; update exports and callers that construct LoadedFlow

## 2. packages/workspace – resolve and load

- [x] 2.1 resolveFlowId: for handlers entry detect specPaths (not specPath); resolve each path against configDir; return ResolvedFlow openapi with specPaths, operation, options
- [x] 2.2 loadFlowFromResolved: for openapi, call mergeOpenApiSpecs(resolved.specPaths, configDir) then openApiToFlows(merged, options); return { flow }; for file, loadFromFile(path), return { flow }
- [x] 2.3 createResolveFlow: return async (flowId) => { flow } | null; remove flowFilePath and openApiContext from return
- [x] 2.4 resolveAndLoadFlow: return Promise<{ flow }>; ensure no flowFilePath or openApiContext in return

## 3. packages/workspace – discover and file scope

- [x] 3.1 buildDiscoverCatalog: for OpenAPI entries use specPaths, merge specs, then openApiToFlows(merged, ...); file flows from findFlowFiles(flowsDir or cwd only)
- [x] 3.2 findFlowFiles / file flow scope: use only flowsDir (or cwd); remove any logic that scopes by flowFilePath

## 4. packages/workspace – consolidate files

- [x] 4.1 Merge loadFlow.ts and resolveFlow.ts into config.ts (or single module); keep one place for config types, resolveFlowId, loadFlowFromResolved, createResolveFlow, resolveAndLoadFlow; update index.ts exports

## 5. Consumers – use only flow

- [x] 5.1 apps/cli: remove any use of openApiContext, flowFilePath, specPath, path from LoadedFlow; use only flow from resolveAndLoadFlow and createResolveFlow result
- [x] 5.2 apps/mcp-server: same as 5.1 for executor_flow, discover, and resolve usage
- [x] 5.3 apps/flow-viewer server workspace-api: if it uses resolveFlowId/LoadedFlow/flowFilePath, update to new contract (only flow) and flowsDir scope

## 6. Examples and tests

- [x] 6.1 examples/config/runflow.config.json: change OpenAPI entry from specPath to specPaths (array)
- [x] 6.2 packages/workspace: add or update tests for specPaths, mergeOpenApiSpecs, ResolvedFlow openapi shape, LoadedFlow { flow } only, resolveFlowId/createResolveFlow return shape
- [x] 6.3 pnpm run check (typecheck, lint, test) passes after all changes
