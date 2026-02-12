# Design: mcp-server-features

## Context

- **Current state**: MCP server exposes `execute` (formerly run_flow) with argument `flowId` (file path or prefix-operation) and may read runflow.config. CLI already uses a single `flowId` (file path or `prefix-operation`), config with `flowsDir` and prefix-keyed `openapi` (specPath, hooks), and a `resolveFlowId()` that resolves flowId to either a file path or an OpenAPI flow.
- **Constraint**: MCP and CLI SHALL share the same flowId semantics and config shape so one runflow.config works for both; paths in config are relative to the config file directory.
- **Stakeholders**: Cursor (and other MCP clients), CLI users; both consume the same flows and config.

## Goals / Non-Goals

**Goals:**

- MCP execute tool accepts `flowId` (file path or `prefix-operation`) and resolves it using the same rules as the CLI (config.flowsDir for file paths, config.openapi[prefix] for OpenAPI).
- MCP loads runflow.config (optional) from cwd or from a path given at startup; supports flowsDir, openapi (prefix → specPath + hooks), and optionally handlers.
- discover tool uses config.flowsDir as the default directory when the client does not supply one.
- Single, consistent config format (prefix-keyed openapi + flowsDir) for both CLI and MCP.

**Non-Goals:**

- SSE transport or MCP Resources; custom handler registration remains optional.
- Changing @runflow/core or convention-openapi public APIs; only CLI and MCP app code and config shape change.

## Decisions

### 1. Where to implement flowId resolution

- **Chosen**: Reuse the same resolution logic the CLI uses. If the resolver lives in the CLI package, MCP will depend on a shared layer or duplicate the logic.
- **Alternatives**: (A) New package `@runflow/config` (or `runflow-resolve`) exporting `loadConfig`, `resolveFlowId`, and config types — keeps CLI and MCP in sync but adds a package. (B) MCP duplicates resolveFlowId and config types — simple but drift risk.
- **Rationale**: Prefer (A) if we expect more consumers (e.g. GUI); otherwise (B) is acceptable with clear comments that resolution MUST match CLI. Proposal left this open; design chooses: **implement resolution in CLI and export from CLI** (e.g. named exports `resolveFlowId`, `loadConfig`, `RunflowConfig`) so MCP can `import { resolveFlowId, loadConfig } from '@runflow/cli'` or from a thin shared package. If CLI is not importable as a library, duplicate the logic in MCP and document that it must match CLI behavior.

**Decision**: MCP depends on a **shared resolution module**. Add a small internal package or export from CLI: `resolveFlowId(flowId, config, configDir, cwd)`, `loadConfig(path)`, and types `RunflowConfig`, `ResolvedFlow`, `OpenApiEntry`. MCP imports these and uses them in execute and discover. This avoids drift and keeps one source of truth.

### 2. When and where MCP loads config

- **Chosen**: Load config once at server startup (or on first tool call). Config path: (1) from argv (e.g. `--config path`) or env (e.g. `RUNFLOW_CONFIG`), or (2) discover in cwd (runflow.config.mjs, runflow.config.js, or runflow.config.json). Same discovery as CLI.
- **Rationale**: MCP is long-lived; reloading config on every request is possible but not required for v1. Startup load is simpler and matches “config is process-level.”

### 3. discover default directory

- **Chosen**: When the discover tool is invoked without a `directory` argument (or with a sentinel like `"."` meaning “default”), use config.flowsDir if config is loaded and flowsDir is set; otherwise use cwd.
- **Rationale**: Aligns with file flowId resolution and gives a single “flows root” for both execute and discover.

### 4. Registry (handlers) in MCP

- **Chosen**: When config is present and has `handlers`, MCP builds the registry the same way as CLI (createBuiltinRegistry + merge config handlers). When no config or no handlers, use only createBuiltinRegistry.
- **Rationale**: Spec allows “MAY merge handlers from runflow.config”; matching CLI avoids surprises when the same flow is run from CLI vs MCP.

## Risks / Trade-offs

- **[Risk] MCP package depending on CLI or a new shared package** → Mitigation: Prefer a small `packages/runflow-config` (or `runflow-resolve`) with zero/minimal deps (only Node + optional convention-openapi for types) so both CLI and MCP depend on it; CLI then uses it for its own resolution. If we want to avoid new packages, MCP can duplicate the resolver and we add a short “MUST match CLI behavior” note in the spec.
- **[Risk] Breaking change for existing MCP clients using flowPath** → Mitigation: Document in release notes; bump MCP server version; clients must switch to `flowId`.
- **[Trade-off] Config loaded at startup only** → If user edits runflow.config, MCP must be restarted to pick up changes. Acceptable for v1; optional “reload on next request” can be added later.

## Migration Plan

1. **Code**: Implement shared resolveFlowId + loadConfig (or move from CLI into shared package). Update MCP execute to use flowId and shared resolver; add config loading at startup; update discover default directory from config.flowsDir. CLI already uses flowId and prefix-keyed openapi + flowsDir; ensure config-openapi spec and CLI implementation are aligned.
2. **Config**: Users with existing single openapi block migrate to prefix form, e.g. `openapi: { myApi: { specPath: './openapi.yaml', hooks: ... } }` and use flowId `myApi-get-users`.
3. **Rollback**: Revert MCP to accept flowPath again (feature flag or release rollback); config format change is additive if we keep backward compat for “flat” openapi in CLI (this change does not require CLI to support old format; CLI already uses prefix-keyed in code).

## Open Questions

- None blocking. Optional: env var name for config path (e.g. `RUNFLOW_CONFIG`); argv convention for MCP (e.g. `node dist/index.js --config ./runflow.config.mjs`).
