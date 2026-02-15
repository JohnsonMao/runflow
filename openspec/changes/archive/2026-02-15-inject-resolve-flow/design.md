## Context

The executor (packages/core) today implements `runFlow` internally: it resolves the flow step's `flow` string as a path relative to the caller flow's directory (`dirname(flowFilePath)`), forbids path traversal (`..`), and loads via `loadFromFile` only. Entry points (MCP, CLI) use `resolveFlowId(config, …)` to resolve by workspace (`flowsDir`) and OpenAPI (`prefix-operation`), but that logic is not available when a flow step calls another flow. As a result, flow steps cannot call flows in other folders under the workspace or OpenAPI-derived flows. The proposal is to inject an optional resolver so the runner supplies resolution while core keeps depth limits and orchestration.

## Goals / Non-Goals

**Goals:**

- Allow flow steps to call any flow under a configured workspace (e.g. `flowsDir`) and any OpenAPI flow (e.g. `prefix-operation`) when the runner provides a resolver.
- Keep core free of dependencies on runflow-config and convention-openapi; resolution contract is a single async function.
- Preserve backward compatibility: when no resolver is provided, behavior remains "path under caller directory, file only."

**Non-Goals:**

- Changing the flow step YAML shape or handler API; the `flow` field remains a string (semantics extend to flowId).
- Adding multiple workspace roots or new config keys in this change; the runner decides how to implement the resolver (e.g. from existing config).

## Decisions

**1. Resolver shape and placement**

- **Decision**: Add to `RunOptions` an optional `resolveFlow(flowId: string): Promise<{ flow: FlowDefinition, flowFilePath?: string } | null>`. The executor calls it when present; otherwise it uses the current file-based resolution.
- **Rationale**: Runner already has `resolveFlowId` and load logic; a single async function keeps core's surface small and avoids passing config into core. Returning `{ flow, flowFilePath? }` lets the executor pass a sensible `flowFilePath` into nested `run()` for logging and for any future path-relative behavior when resolver is not used in a nested call.
- **Alternatives**: (a) Pass `flowsBaseDir` only — would allow workspace-wide file resolution but not OpenAPI. (b) Pass a sync resolver — would block async OpenAPI loading (e.g. `openApiToFlows`).

**2. Executor runFlow branching**

- **Decision**: Inside the executor, if `options.resolveFlow` is set, `runFlow(flowId, params)` calls `await options.resolveFlow(flowId)`; on non-null result it runs the returned flow with the same `resolveFlow` and incremented depth. If `resolveFlow` is absent, keep existing logic: baseDir = dirname(flowFilePath), resolve path under baseDir, loadFromFile.
- **Rationale**: Single place for resolution policy; depth and `run()` orchestration stay in core; nested flow steps automatically get the same resolver.
- **Alternatives**: Moving all of runFlow into the runner would require passing depth and options into the runner and complicate the API.

**3. Type for resolver result**

- **Decision**: Use an inline shape `{ flow: FlowDefinition, flowFilePath?: string }`; optional `flowFilePath` for file flows or OpenAPI (e.g. spec path). No new export required if the type is only used in RunOptions.
- **Rationale**: Minimal surface; runners can construct this from `resolveFlowId` + load. If multiple runners need it, a shared type can be added to core later.

**4. Runner implementation**

- **Decision**: MCP and CLI, when calling `run(flow, options)`, build a `resolveFlow` that: (1) calls `resolveFlowId(flowId, config, configDir, cwd)`; (2) if file, resolve path and `loadFromFile(path)`; (3) if openapi, load spec and `openApiToFlows(...).get(operation)`; (4) return `{ flow, flowFilePath }` or null. Pass the same function so nested runs also use it.
- **Rationale**: Reuses existing resolution and loading; no duplication of flow-call semantics.

## Risks / Trade-offs

- **[Risk] Resolver throws or returns invalid flow** → Mitigation: Executor treats thrown errors and null as "flow not found or failed to load" and returns a failed RunResult with an error message; runner can log details.
- **[Risk] Async resolver in core** → Mitigation: RunOptions already support async (e.g. future async registry); executor is already async; one extra await in the hot path is acceptable.
- **[Trade-off] flowId vs path in step.flow** → The same string is interpreted as flowId when resolver is present and as path when it is not; documented in spec so YAML authors know that with MCP/CLI they can use e.g. `simple-getPet`.

## Migration Plan

- No data migration. Runners that do not pass `resolveFlow` keep current behavior.
- Deploy: ship core with optional `resolveFlow`; then update MCP server and CLI to pass it when config is available. No rollback beyond reverting runner changes (core remains backward compatible).

## Open Questions

- None for MVP. Optional follow-up: shared type for resolver result in a public core type if other consumers appear.
