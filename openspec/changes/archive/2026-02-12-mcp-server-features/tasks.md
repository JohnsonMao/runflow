## 1. Shared config and flowId resolution

- [x] 1.1 Export from CLI or add package: expose `loadConfig`, `resolveFlowId`, and types `RunflowConfig`, `ResolvedFlow`, `OpenApiEntry` so MCP can import and use the same resolution semantics as CLI
- [x] 1.2 Ensure resolveFlowId supports prefix-keyed openapi and flowsDir; paths resolved relative to config file directory

## 2. MCP config loading

- [x] 2.1 At MCP server startup (or first tool use), discover or load runflow.config: from argv (e.g. `--config path`), env (e.g. `RUNFLOW_CONFIG`), or cwd (runflow.config.mjs, runflow.config.js, or runflow.config.json)
- [x] 2.2 When config is present and has `handlers`, build registry with createBuiltinRegistry plus config handlers (same logic as CLI); otherwise use createBuiltinRegistry only

## 3. MCP execute tool with flowId

- [x] 3.1 Change execute tool (formerly run_flow) argument from `flowPath` to `flowId` in inputSchema and handler
- [x] 3.2 In execute handler: call resolveFlowId(flowId, config, configDir, cwd); if file, loadFromFile and run; if openapi, openApiToFlows for that prefix and run the selected operation flow
- [x] 3.3 Add dependency on shared resolver (or @runflow/cli if exported) and @runflow/convention-openapi for openApiToFlows when resolving openapi flowIds
- [x] 3.4 Return same result shape (success/error content) as today; keep formatRunResult behavior

## 4. MCP discover tool default directory

- [x] 4.1 When discover tool (formerly list_flows) is called without directory (or default), use config.flowsDir resolved from config directory when config is loaded and flowsDir is set; otherwise use cwd
- [x] 4.2 Ensure findFlowFiles / discover uses the chosen base directory consistently with execute file resolution

## 5. Verification and docs

- [x] 5.1 Add or update MCP tests: execute with flowId as file path; execute with flowId as prefix-operation when config has openapi; discover with config.flowsDir as default
- [x] 5.2 Update apps/mcp-server README: flowId (file or prefix-operation), config (flowsDir, openapi), and Cursor MCP args example (e.g. `--config` if supported)
- [x] 5.3 Run `pnpm --filter @runflow/mcp-server build` and `pnpm --filter @runflow/cli test` (and mcp-server test if any) to verify no regressions
