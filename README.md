# Runflow

Monorepo for YAML-defined reusable execution flows. Uses TypeScript, pnpm, and Turborepo.

## Structure

- **packages/core** (`@runflow/core`) – Flow engine: parse YAML, validate schema, run steps. Does **not** include built-in step handlers; you must pass a **registry** when calling `run()`.
- **packages/handlers** (`@runflow/handlers`) – Built-in step handlers (command, js, http, condition, sleep, set, loop, flow). Use `createBuiltinRegistry()` and pass the registry to `run(flow, { registry })`; override or add with `registry.myType = myHandler`.
- **apps/cli** (`@runflow/cli`) – CLI to run a flow from a YAML file (uses `@runflow/handlers` to build the default registry).
- **apps/mcp-server** (`@runflow/mcp-server`) – MCP server (stdio) that exposes `execute` and `discover` tools for MCP clients (e.g. Cursor). See [apps/mcp-server/README.md](apps/mcp-server/README.md).

## Prerequisites

- Node.js 18+
- pnpm 9+

## Install

```bash
pnpm install
```

## Run a flow

Build the CLI, then run a flow file:

```bash
pnpm run build
node apps/cli/dist/cli.js run examples/hello-flow.yaml
```

Or from the CLI package:

```bash
pnpm --filter @runflow/cli build
pnpm --filter @runflow/cli exec node dist/cli.js run ../../examples/hello-flow.yaml
```

Options:

- `--dry-run` – Parse and validate only; do not execute steps.
- `--verbose` – Print per-step stdout/stderr.
- `--param <key=value>` – Pass a parameter (repeatable). Merged into initial context.
- `--params-file <path>` / `-f` – Load params from a JSON file (object). Merged with `--param`; `--param` overrides same keys.
- `--config <path>` – Path to `runflow.config.mjs` (default: cwd). Used for custom step handlers and OpenAPI options.
- `--from-openapi <path>` – Load flow from an OpenAPI spec; requires `--operation <key>` (e.g. `get-users`).

**Config and OpenAPI**: In `runflow.config.mjs` you can set `openapi: { specPath, outDir, baseUrl, operationFilter, hooks }`. These options are used when running with `--from-openapi`; CLI flags override config when both are provided. Paths in config are resolved relative to the config file directory.

To list parameters declared by a flow: `flow params <file>` (shows name, type, required, default, enum, description).

## MCP

The **MCP server** lets Cursor (or other MCP clients) run flows via the `execute` tool over stdio. Build and start from repo root:

```bash
pnpm --filter @runflow/mcp-server build
pnpm --filter @runflow/mcp-server start
```

Configure your MCP client with command `node` and args `apps/mcp-server/dist/index.js`, with cwd set to the repo root. See [apps/mcp-server/README.md](apps/mcp-server/README.md) for Cursor setup and tool parameters.

## YAML flow format

**Key naming**: Use **camelCase** in YAML for multi-word keys (e.g. `dependsOn`, `outputKey`). Single-word keys (`name`, `steps`, `id`, `type`, `run`) are unchanged.

Minimal schema:

```yaml
name: my-flow
description: optional
steps:
  - id: step1
    type: set
    set: { done: true }
    dependsOn: []
  - id: step2
    type: set
    set: { result: 2 }
    dependsOn: [step1]
```

- `name` – Flow name (for logs and errors).
- `steps` – Steps form a **DAG**: each step may have `dependsOn: [stepId, ...]`. Steps **without** `dependsOn` are **orphans** (not executed). Use `dependsOn: []` for entry (root) steps. Execution order is by dependency; steps in the same wave may run in parallel.
- `params` (optional) – Top-level parameter declaration: array of `{ name, type, required?, default?, enum?, description?, schema?, items? }`. When present, run-time params are validated (e.g. with Zod) before execution.
- Supported step types: `set` (writes key-value object to context), `http` (sends an HTTP request), `condition` (evaluates `when`; use `then`/`else` step ids to run only one branch; result is not written to context).
- **Set steps** use `type: set` with `set: { key: value, ... }`. Values support template substitution `{{ key }}`, `{{ obj.nested }}`. Object/array values are JSON-stringified; undefined/null → empty string.
- **HTTP steps** use `type: http` with required `url`; optional `method`, `headers`, `body`, `outputKey` (context key for the response). All string fields support `{{ key }}` substitution. On 2xx the response is written to context as `{ statusCode, headers, body }`; body is parsed as JSON when Content-Type is application/json. Non-2xx responses set the step as failed with no outputs. Example: `examples/http-flow.yaml`.
- **Condition steps** use `type: condition` with required `when` (JS expression evaluated with `params` in scope, e.g. `params.env === 'prod'`). Optional `then` / `else` are step id(s); only the matching branch runs. The condition result is **not** merged into context. Only steps listed in `then` or `else` may have `dependsOn: [conditionStepId]`; the engine validates before run and fails with a clear error if any other step depends on the condition. The same rule applies to **loop** steps: only steps in `entry` or `done` may have `dependsOn: [loopStepId]`.
- **Migration**: Existing flows must add `dependsOn` to every step that should run. Use `dependsOn: []` for the first step and `dependsOn: [previousStepId]` for the rest in a linear flow. See `examples/hello-flow.yaml` or `examples/dag-linear-flow.yaml`.

## Scripts

- `pnpm run build` – Build all packages.
- `pnpm run test` – Run tests.
- `pnpm run typecheck` – Type-check all packages (run before commit).
- `pnpm run lint` – Lint all packages.
- `pnpm run lint:fix` – Lint and fix.
- `pnpm run check` – Run typecheck, lint, and test (full check).

## Build

Packages are built with **tsup** (esbuild). Source imports do not need `.js` extensions; the bundler resolves them.

## Upgrading dependencies

Versions are managed via **pnpm catalogs** in `pnpm-workspace.yaml` (e.g. `catalogs.dev`, `catalogs.prod`). Packages reference them with `catalog:dev` or `catalog:prod`.

- **Change a version**: Edit the version in `pnpm-workspace.yaml` under the right catalog, then run `pnpm install`.
- **Update to latest within semver**: From repo root, run `pnpm update` (or `pnpm up`). To see what would change without writing the lockfile: `pnpm update --dry-run`.
- **Update a specific package**: `pnpm update <pkg>` or `pnpm update -r` to update all workspace packages.

After upgrading, run `pnpm run check` to ensure build, typecheck, lint, and tests still pass.

## Development

### Daily workflow

1. **Start working**: `pnpm install` (after pull), then edit code in `packages/core` or `apps/cli`.
2. **Build while editing**: From root, `pnpm run dev` runs `tsup --watch` in both packages; or run `pnpm --filter @runflow/core dev` / `pnpm --filter @runflow/cli dev` for a single package.
3. **Run the CLI**: After build, `node apps/cli/dist/cli.js run examples/hello-flow.yaml` (or use the path to your flow YAML).
4. **Test**: `pnpm run test` (all packages) or `pnpm --filter @runflow/core test` / `pnpm --filter @runflow/cli test`.
5. **Before commit**: `pnpm run check` (typecheck + lint + test), then `pnpm run lint:fix` if needed.

### Adding a new feature

Use **OpenSpec** so changes stay spec-driven and traceable:

1. **Create a change**: `openspec new change <name>` (e.g. `add-http-step`). This creates `openspec/changes/<name>/`.
2. **Create artifacts**: Follow the spec-driven flow (proposal → specs → design → tasks). Use `openspec status --change <name>` and `openspec instructions <artifact> --change <name>` to see what to write next.
3. **Implement**: When tasks are ready, run `openspec instructions apply --change <name>` and implement the listed tasks; mark them done in the tasks file.
4. **Verify**: `openspec verify <name>` (if available), then `pnpm run check`.

See `.cursor/commands/opsx-*.md` or the OpenSpec skills in `.cursor/skills/openspec-*` for the exact commands.

### Using the engine programmatically

The engine does not provide a default registry. You must build one and pass it to `run()`:

```ts
import { run } from '@runflow/core'
import { createBuiltinRegistry } from '@runflow/handlers'

const registry = createBuiltinRegistry()
const result = await run(flow, { registry, params: { a: 1 } })
```

To add custom step types, assign your handler to the registry: `registry.myType = myHandler` (or `registry['myType'] = myHandler`) after creating the registry (e.g. after `createBuiltinRegistry()`).

### Where to edit

- **Flow engine (parse YAML, run steps)**: `packages/core/src/` — add types in `types.ts`, constants in `constants.ts`. Step execution is dispatched via the registry; built-in handlers live in `packages/handlers`.
- **CLI (commands, flags, output)**: `apps/cli/src/cli.ts`.
- **Example flows**: `examples/*.yaml`.

### Next steps (from the original plan)

- **More step types**: e.g. `http`, `script` — extend `packages/core` types and executor, then add tests.
- **MCP Server**: New app that uses `@runflow/core` and exposes “run flow” as an MCP tool.
- **GUI**: New app (e.g. Vite + React) that uses `@runflow/core` to list and run flows.

Start each of these with an OpenSpec change so the scope and tasks stay clear.

## OpenSpec

Changes are managed with OpenSpec (spec-driven workflow). See `openspec/config.yaml` and `openspec/` for changes.
