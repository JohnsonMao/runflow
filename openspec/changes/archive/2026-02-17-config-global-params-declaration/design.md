# Design: Config global params declaration

## Context

RunflowConfig today has `params?: Record<string, unknown>`: a plain object of default values. There is no global param contract (names, types, required, enum). Validation only happens per flow via each flow’s `params` array. The proposal replaces config’s `params` with `params?: ParamDeclaration[]` (same shape as flow’s params), so config defines global declarations with defaults in each item’s `default`. Effective declaration for a run is config.params merged with flow.params, with **flow overriding** config for the same param name. Runners (CLI, MCP) build options.params from -f/--param and pass effective declaration into validation.

## Goals / Non-Goals

**Goals:**
- Config exposes global param declarations (params as ParamDeclaration[]); no separate “values only” key.
- Effective declaration = config.params + flow.params with flow override on same name; validation and defaults use it.
- run() validates options.params against the effective declaration; default resolution uses declaration defaults then options.params.
- Single migration path for existing configs that use params as object (deprecation or one-time compat).

**Non-Goals:**
- No change to flow YAML params shape or to ParamDeclaration type in core.
- No new config keys (e.g. paramsDefaults); defaults live only in declaration and -f/--param.

## Decisions

### 1. Who computes “effective declaration”

**Decision:** Caller (CLI / MCP) computes effective declaration and passes it into run() via a new option (e.g. `effectiveParamsDeclaration?: ParamDeclaration[]`). Core does not load config; it only validates options.params against the declaration it is given.

**Rationale:** Keeps core independent of workspace/config. Runners already have config and flow; they merge and pass one array to core. Alternative (core accepting config + flow and merging) would require core to depend on or receive config, which we avoid.

### 2. Merge algorithm (config + flow, flow overrides)

**Decision:** Effective declaration = list built by: (1) start with config.params (if present); (2) for each flow.params item, if name already exists in the list, replace that entry; otherwise append. Result is one ParamDeclaration[] with no duplicate names; flow wins on same name.

**Rationale:** Simple and predictable. Flow can override type, required, default, enum for a global param, and can add flow-only params.

### 3. Default resolution for initial context

**Decision:** Initial params for execution = apply declaration defaults (from effective declaration) for any key not present in options.params, then overlay options.params. Same as today when only flow.params exists: paramsSchema already applies defaults from declaration; we just feed it the effective declaration instead of only flow.params.

**Rationale:** Reuses existing default application in core (paramsDeclarationToZodSchema / defaultForDecl); no new default semantics.

### 4. Migration / backward compatibility for config.params as object

**Decision:** In workspace loadConfig, if `params` is present and is a plain object (not an array), treat as legacy: convert to ParamDeclaration[] by mapping each key to `{ name: key, type: 'string', default: value }`. Emit a one-time deprecation warning (or document only, no runtime warning, to avoid noise). After one release, remove legacy support and require array shape.

**Rationale:** Gives existing configs a clear migration path without breaking them immediately. Type in RunflowConfig becomes `params?: ParamDeclaration[]`; at load time we normalize legacy object into that shape.

**Alternative considered:** Hard break, no compat. Rejected to allow gradual migration.

### 5. run() API extension

**Decision:** Add to RunOptions something like `effectiveParamsDeclaration?: ParamDeclaration[]`. When present, run() uses it instead of flow.params for validation and default application. When absent, behavior unchanged: use flow.params only (backward compatible for callers that don’t pass it).

**Rationale:** Core stays backward compatible; only runners that have config pass the merged declaration.

## Risks / Trade-offs

- **[Risk] Callers forget to pass effective declaration** → Mitigation: CLI and MCP always build it when config is loaded; docs and spec require runners to merge and pass when config has params.
- **[Risk] Legacy object conversion loses type fidelity** (everything becomes string) → Mitigation: Document that legacy params are best-effort string; users should migrate to array form for correct types.
- **[Trade-off] Two sources of “defaults” (declaration default vs options.params)** → Resolved: declaration defaults apply first, then options.params overlay; -f/--param remain the way to override at run time.

## Migration Plan

1. **Workspace:** Change RunflowConfig.params type to `ParamDeclaration[]`; in loadConfig, if value is object, convert to array and optionally log deprecation. Export a small helper `normalizeConfigParams(raw): ParamDeclaration[] | undefined` if useful for tests.
2. **Core:** Add `effectiveParamsDeclaration?: ParamDeclaration[]` to RunOptions. In executor, when effectiveParamsDeclaration is provided, use it for params schema build and validation; otherwise use flow.params. No change to FlowDefinition type.
3. **CLI:** When config is loaded, compute effectiveParamsDeclaration = merge(config.params, flow.params) with flow override; pass to run(). Build options.params from config default values (from declaration) + -f + --param (existing merge order).
4. **MCP:** Same as CLI for execute: merge config.params with flow.params, build options.params from tool args, pass effectiveParamsDeclaration to run().
5. **Docs / examples:** Update examples/config to use params array; add migration note in README or changelog.
6. **Later:** Remove legacy object handling in loadConfig after one release cycle.

## Open Questions

- Whether to emit a deprecation warning when legacy params object is detected (could be noisy in CI). Prefer doc-only migration and no warning unless we add a quiet flag.
