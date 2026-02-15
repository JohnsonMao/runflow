## 1. Core types and RunOptions

- [x] 1.1 Add optional `resolveFlow` to RunOptions and define resolver result type (flow + optional flowFilePath) in packages/core types
- [x] 1.2 Export resolver result type (or keep inline) so runners can type their implementation

## 2. Executor runFlow

- [x] 2.1 In executor, when `options.resolveFlow` is present, call it with step's flow string; on non-null result run the returned flow with same resolveFlow and incremented depth
- [x] 2.2 When `options.resolveFlow` is absent, keep current logic (baseDir from flowFilePath, path under baseDir, loadFromFile)
- [x] 2.3 Handle resolver returning null or throwing: return RunResult with success false and error message

## 3. Core tests

- [x] 3.1 Add executor tests: runFlow with injected resolveFlow resolves flowId and runs returned flow; nested flow step uses same resolver
- [x] 3.2 Add executor tests: runFlow with resolveFlow returning null yields flow not found error
- [x] 3.3 Ensure existing tests (no resolver, path under caller dir, path traversal rejected) still pass

## 4. MCP server

- [x] 4.1 Build resolveFlow using resolveFlowId(config, configDir, cwd) and file/OpenAPI load in apps/mcp-server
- [x] 4.2 Pass resolveFlow into run() when executing a flow (both file and OpenAPI entry points)
- [x] 4.3 Add or adjust tests: flow step can call flow by workspace path and by prefix-operation when config has openapi

## 5. CLI

- [x] 5.1 Build resolveFlow in apps/cli using same pattern as MCP (resolveFlowId + load)
- [x] 5.2 Pass resolveFlow into run() when invoking flow run
- [x] 5.3 Manual or test: CLI flow run with flow that contains flow step calling another workspace flow or OpenAPI flowId

## 6. Docs and spec sync

- [x] 6.1 Update flow-call-step main spec (or leave delta for archive); ensure discover/list docs mention flowId for flow step when resolver is used
