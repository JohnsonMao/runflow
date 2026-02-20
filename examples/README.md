# Examples

This directory provides Runflow example structure and runnable flows, aligned with the **workspace** layout (`config`, `flows`, `openapi`, custom handlers).

## Directory structure

```
examples/
├── README.md           # This file
├── params.json         # Sample params file (for params-flow)
├── config/
│   └── runflow.config.json   # flowsDir, handlers (echo), openapi (baseUrl, operationFilter, hooks)
├── openapi/
│   └── simple.yaml     # Minimal OpenAPI spec (e.g. simple-listUsers flows)
├── flows/
│   ├── basic/          # Basic example flows
│   │   ├── http.yaml
│   │   ├── params-flow.yaml
│   │   ├── dag-linear.yaml
│   │   ├── condition-flow.yaml
│   │   ├── sub.yaml
│   │   ├── flow-call.yaml
│   │   └── echo-demo.yaml    # Uses custom echo handler
│   └── complex/        # Complex flow (set/condition/loop/sleep/http/flow, every step has name)
│       └── demo.yaml
└── custom-handler/     # Custom step handler source only
    ├── README.md
    └── echo-handler.mjs
```

## Prerequisites

Build the CLI from the repo root:

```bash
pnpm run build
```

## How to run

Use the single config at `examples/config/runflow.config.json` (it sets `flowsDir`, openapi, and the `echo` handler). FlowId is **relative to the flows directory**:

```bash
node apps/cli/dist/cli.js run basic/http.yaml --config examples/config/runflow.config.json --verbose
node apps/cli/dist/cli.js run basic/params-flow.yaml --config examples/config/runflow.config.json --param name=World
node apps/cli/dist/cli.js run basic/params-flow.yaml --config examples/config/runflow.config.json -f examples/params.json
node apps/cli/dist/cli.js run basic/dag-linear.yaml --config examples/config/runflow.config.json
node apps/cli/dist/cli.js run basic/condition-flow.yaml --config examples/config/runflow.config.json --param branch=then
node apps/cli/dist/cli.js run basic/flow-call.yaml --config examples/config/runflow.config.json --param from=main
node apps/cli/dist/cli.js run basic/echo-demo.yaml --config examples/config/runflow.config.json --verbose
```

Complex flow (all built-in step types, each step has `name`):

```bash
node apps/cli/dist/cli.js run complex/demo.yaml --config examples/config/runflow.config.json --param branch=then --verbose
node apps/cli/dist/cli.js run complex/demo.yaml --config examples/config/runflow.config.json --param branch=else --verbose
```

OpenAPI-derived flows (with `baseUrl`, `operationFilter`, and `hooks` applied from config):

```bash
node apps/cli/dist/cli.js run simple:get-users --config examples/config/runflow.config.json --verbose
node apps/cli/dist/cli.js run simple:get-users-userId --config examples/config/runflow.config.json --param userId=550e8400-e29b-41d4-a716-446655440000 --verbose
```

Without config you can pass a flow file path from the repo root:

```bash
node apps/cli/dist/cli.js run examples/flows/basic/http.yaml
```

## Config options (runflow.config.json)

The single config demonstrates all supported top-level and OpenAPI options.

### Top-level

| Option | Description |
|--------|-------------|
| **handlers** | Custom step types: `{ "typeName": "path/to/handler.mjs" }`. Paths relative to config file directory. |
| **flowsDir** | Directory for file flowIds (relative to config dir). When set, flowId is resolved under this dir. |
| **params** | Global param **declarations** (same shape as a flow’s `params`): array of `{ name, type, required?, default?, enum?, description?, schema?, items? }`. Defaults live in each item’s `default`. For each run, the effective declaration is config params merged with flow params, with **flow overriding** config for the same param name. Runners pass this effective declaration to the engine; run-time overrides come from `-f` / `--param`. |
| **handlers** (OpenAPI entry) | Object with `specPath` (and optional `baseUrl`, `operationFilter`, `paramExpose`, `handler`). flowId for OpenAPI flows = `handlerKey:operationKey` (e.g. `simple:get-users`). |

### OpenAPI entry (per prefix)

| Option | Description |
|--------|-------------|
| **specPath** | OpenAPI spec file path (relative to config dir). |
| **baseUrl** | Base URL for the API (e.g. `https://api.example.com`). Used when running the generated HTTP step. |
| **operationFilter** | Limit which operations become flows. All optional: **method** (e.g. `"get"`), **path** (e.g. `"/users"`), **operationId** (e.g. `"listUsers"`), **tags** (array of tag names). |
| **hooks** | Steps injected before/after the API step. Two forms: **Record** by operation key: `{ "get-users": { "before": [...], "after": [...] } }`; **Array** with **pattern** (exact key or regex string): `[{ "pattern": "^get-", "hooks": { "before": [...], "after": [...] } }]`. Hook steps use the same shape as flow steps (`type`, `set`, optional `dependsOn`); order is before → API → after. |

Other runner options (e.g. `allowedHttpHosts`, `maxFlowCallDepth`) are passed at run time via the runner (CLI/MCP), not via the config file.

### Params: config (global declaration) vs flow (override and extend)

Config `params` is a **ParamDeclaration[]** (same shape as a flow’s `params`). It defines global param names, types, and defaults. For each run, the **effective declaration** is config params merged with flow params; **flow overrides** config for the same param name and can add more params.

| Where | Shape | Purpose |
|-------|--------|---------|
| **Config** `params` | Array of `{ name, type, required?, default?, enum?, description?, schema?, items? }` | Global param declarations. Every flow run uses these merged with the flow’s own params (flow wins on same name). |
| **Flow** `params` | Same array shape | Declaration for that flow; overrides or extends config params for the same name. Run-time values (`-f`, `--param`) are validated against the effective declaration. |

Example: config has `params: [{ name: "env", type: "string", default: "example" }]` and a flow has `params: [{ name: "env", type: "string", default: "production" }]` — the effective declaration for that flow uses `env` default `"production"` (flow overrides).

## Custom handler

The `echo` handler is registered in `config/runflow.config.json`. Handler source and contract: [custom-handler/README.md](custom-handler/README.md).

## Mapping to workspace

| examples            | workspace             | Description |
|---------------------|-----------------------|-------------|
| `config/`           | `workspace/config/`   | runflow config (flowsDir, openapi, handlers) |
| `flows/basic/`       | `workspace/flows/tt/` etc. | Flows grouped by topic |
| `openapi/simple.yaml` | `workspace/openapi/*.yaml` | OpenAPI spec for --from-openapi or flow step prefix-operation |
| `custom-handler/`   | (no direct equivalent) | Custom handler source; registered in config |

The workspace holds real project config and flows; examples are minimal, self-contained flows for learning.
