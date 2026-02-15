# Runflow CLI

Command-line interface for running YAML-defined flows. Uses the same **flowId** and **runflow.config** as the MCP server (flowsDir, prefix-keyed openapi, optional handlers).

## Install

From the repo root:

```bash
pnpm install
pnpm --filter @runflow/cli build
```

## Usage

From the repo root after building, run the `flow` binary:

```bash
pnpm exec flow --help
# or: node apps/cli/dist/cli.js --help
```

To use a specific config file:

```bash
flow --config ./runflow.config.mjs list
```

Config is resolved from `--config` (per command) or `runflow.config.mjs` / `runflow.config.js` in the current working directory.

## Commands

### `flow run [flowId]`

Execute a flow by **flowId** (file path or prefix-operation, e.g. `my-api-get-users`).

- **--dry-run** – Parse and validate only, do not execute steps.
- **--verbose** – Print per-step log and outputs.
- **--param &lt;key=value&gt;** – Pass a parameter (repeatable).
- **--params-file &lt;path&gt;** / **-f &lt;path&gt;** – Load params from a JSON file.
- **--config &lt;path&gt;** – Path to runflow.config.mjs.

When a flow contains a **flow step** (type `flow`), the step's `flow` field is resolved as a **flowId** using the same config (workspace path or prefix-operation).

### `flow list`

List flows (file flows under flowsDir/cwd + OpenAPI flows from config). Same data as MCP discover_flow_list.

- **--limit &lt;n&gt;** – Max number of flows (default 10, max 10).
- **--offset &lt;n&gt;** – Skip N flows (pagination).
- **--keyword &lt;s&gt;** – Filter by flowId, name, or description (case-insensitive).
- **--config &lt;path&gt;** – Path to runflow.config.mjs.
- **--json** – Output raw JSON `{ total, entries }` for programmatic use.

### `flow detail &lt;flowId&gt;`

Show one flow's detail (name, description, params) by flowId. Same as MCP discover_flow_detail.

- **--config &lt;path&gt;** – Path to runflow.config.mjs.
- **--json** – Output raw JSON (single entry) for programmatic use.

## Config (runflow.config.mjs)

Same format as the MCP server:

- **flowsDir** – Directory to resolve file flowIds (relative to config file). When set, file flowIds are relative to this directory.
- **openapi** – Object keyed by prefix; each value has `specPath` and optionally `hooks`, `baseUrl`, `operationFilter`. FlowIds for OpenAPI flows are `prefix-operation` (e.g. `myApi-get-users`).
- **handlers** – Optional custom step handlers.
- **params** – Optional global default params merged into every flow run (caller params override).

## Development

- Build: `pnpm --filter @runflow/cli build`
- Watch: `pnpm --filter @runflow/cli dev`
- Typecheck: `pnpm --filter @runflow/cli typecheck`
- Test: `pnpm --filter @runflow/cli test`
