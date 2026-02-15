## Why

Today a flow step can only call another flow that lives **under the same directory** as the caller flow file; resolution is done inside the executor using the caller’s `flowFilePath` and file loading only. That prevents reusing flows across the workspace (e.g. under a configured `flowsDir`) and prevents calling OpenAPI-derived flows (e.g. `simple-getPet`) from within a flow. Entry points (MCP, CLI) already resolve by workspace and OpenAPI via `resolveFlowId` and config; the same semantics should apply when a flow step calls another flow. Injecting a resolver into the executor keeps core free of config/openapi dependencies while giving the runner full control over resolution scope and callee type.

## What Changes

- **RunOptions**: Add optional `resolveFlow(flowId: string): Promise<{ flow: FlowDefinition, flowFilePath?: string } | null>`. When present, the executor’s internal `runFlow` uses it to resolve the callee; when absent, keep current behavior (resolve path relative to caller’s directory, load from file only).
- **Executor `runFlow`**: If `options.resolveFlow` is set, call it with the step’s `flow` string (treated as flowId); on success run the returned flow with the same `resolveFlow` so nested calls stay workspace- and OpenAPI-aware. Depth limit and `run()` orchestration remain in core.
- **Runner (MCP, CLI)**: When calling `run(flow, options)`, pass a `resolveFlow` that uses existing `resolveFlowId(config, …)` and loads either from file or OpenAPI; use the same function for top-level and nested runs so flow steps can call any flow under the workspace or any OpenAPI flow.
- **Flow step `flow` field**: Semantics extend from “path to a file” to “flowId” (path relative to workspace or prefix-operation). Handler and step shape unchanged; only resolution rules change.

No **BREAKING** change when `resolveFlow` is omitted: behavior stays “path under caller directory, file only.”

## Capabilities

### New Capabilities

- None. Resolution is an extension of existing flow-call behavior; the contract is expressed as a change to the flow-call-step requirement (how the engine resolves the callee).

### Modified Capabilities

- **flow-call-step**: The engine SHALL resolve the flow step’s `flow` string (flowId) either (a) via an optional injected resolver when provided in run options—allowing workspace-wide file paths and OpenAPI flowIds (e.g. `prefix-operation`)—or (b) when no resolver is provided, resolve relative to the calling flow’s directory and load from file only (current behavior). Path traversal and “under current flow directory” constraint apply only in the no-resolver case; when a resolver is used, the runner is responsible for what is resolvable.

## Impact

- **packages/core**: `RunOptions` type and executor `runFlow` implementation; optional dependency on an async resolver signature (no dependency on runflow-config or convention-openapi).
- **packages/core types**: Optional `resolveFlow` (and possibly a shared type for its result) in the public run-options/step-context surface used by runners.
- **apps/mcp-server**, **apps/cli**: Build and pass `resolveFlow` when invoking `run()`, using existing `resolveFlowId` and file/OpenAPI loading.
- **packages/handlers**: Flow handler unchanged; it continues to pass `step.flow` to `context.runFlow(…)`; resolution is entirely inside the executor/runner.
