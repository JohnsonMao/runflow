# Proposal: Config global params declaration

## Why

Today config has `params` as a plain object of default values only (`Record<string, unknown>`). That is of limited use: there is no shared contract (names, types, required, enum), and validation only comes from each flow’s own `params`. Users want **global param declarations** (same shape as a flow’s `params` array) so all flows share a common contract, with defaults coming from the declaration. The current “params as values only” is not carrying its weight; replacing it with a declaration is clearer and more useful.

## Recommendation: Replace config `params` with declaration (keep key name `params`)

- **Do not** add a separate `paramsDeclaration` key alongside the existing `params`.
- **Replace** the meaning of config’s `params`: from “values object” to **ParamDeclaration[]** (same shape as flow’s `params`). The key name stays `params`.
- Default values live in each item’s `default` in that array; no separate values object in config.
- **Flow overrides config**: Effective declaration for a run = config.params (global) then **flow.params overrides and extends**. Same param name in both → flow’s declaration wins (and flow can add new params). So “定義好的全局 params 是可以被 flow params 覆蓋掉”.

## What Changes

- **Config**: `params` is redefined as optional **ParamDeclaration[]** (name, type, required?, default?, enum?, description?, schema?, items?). No separate “params values” key; run-time overrides remain `-f` / `--param` from CLI/MCP.
- **Effective declaration**: For each run, effective param declaration = merge(config.params, flow.params) with **flow wins on same name** (flow overrides global). Validation and defaults use this effective declaration; options.params (from CLI/MCP merge) supply run-time values.
- **Workspace**: RunflowConfig.params type changes from `Record<string, unknown>` to `ParamDeclaration[]` (optional). loadConfig unchanged otherwise.
- **Core / run()**: run(flow, options) receives effective declaration (caller computes from config + flow with flow override). Validation uses effective declaration; defaults come from declaration defaults + options.params.
- **BREAKING**: Configs that currently have `params: { "key": value }` must migrate to `params: [{ name: "key", type: "...", default: value }]`. Design can define a short deprecation or migration path (e.g. accept both shapes for one release and treat object as legacy).

## Capabilities

### New Capabilities

- **config-params-declaration**: Config defines global params via `params: ParamDeclaration[]` (same key, new shape). Defaults live in each item’s `default`. Effective declaration for a run is config.params merged with flow.params with **flow overriding** config for the same param name. Runners build effective declaration and options.params; run() validates against effective declaration.

### Modified Capabilities

- **workspace**: RunflowConfig.params SHALL be optional **ParamDeclaration[]** (no longer Record<string, unknown>). loadConfig SHALL return it. Document migration from old params object.
- **flow-params-schema**: run() SHALL validate options.params against the **effective** param declaration (config.params merged with flow.params, flow overrides). Requirement extends to “effective declaration” and default resolution from declaration defaults + options.params.

## Impact

- **packages/workspace**: config.ts RunflowConfig: change params type to ParamDeclaration[]; optionally support legacy object shape during deprecation.
- **packages/core**: run() (or caller) receives or computes effective declaration; validation and default application use it. May add helper to merge config + flow declarations with flow override.
- **apps/cli**: Build effective declaration from config.params + flow.params (flow wins); merge -f/--param into options.params; pass effective declaration and params to run().
- **apps/mcp-server**: Same as CLI for execute.
- **openspec/specs**: New spec config-params-declaration; deltas for workspace and flow-params-schema.
- **examples/config/runflow.config.json**: Migrate current params object to params array (and docs).
