# Runflow

Monorepo for YAML-defined reusable execution flows. Uses TypeScript, pnpm, and Turborepo.

## Structure

- **packages/core** (`@runflow/core`) – Flow engine: parse YAML, validate schema, run steps (e.g. `command`).
- **apps/cli** (`@runflow/cli`) – CLI to run a flow from a YAML file.

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

To list parameters declared by a flow: `flow params <file>` (shows name, type, required, default, enum, description).

## YAML flow format

Minimal schema:

```yaml
name: my-flow
description: optional
steps:
  - id: step1
    type: command
    run: echo "hello"
  - id: step2
    type: command
    run: node -e "console.log(1+1)"
```

- `name` – Flow name (for logs and errors).
- `steps` – Ordered steps; each has `id`, `type`, and type-specific fields (e.g. `run` for `command`).
- `params` (optional) – Top-level parameter declaration: array of `{ name, type, required?, default?, enum?, description?, schema?, items? }`. When present, run-time params are validated (e.g. with Zod) before execution.
- Supported step types: `command` (runs a shell command), `js` (runs JavaScript in-process).
- **Command steps** support template substitution in `run`: `{{ key }}`, `{{ obj.nested }}`, `{{ arr[0] }}`. Object/array values are JSON-stringified; undefined/null → empty string.
- **JS steps** may use `run: "<inline code>"` or `file: "./script.js"` (path relative to the flow file). Only `.js` is supported; `.ts` is rejected.

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

### Where to edit

- **Flow engine (parse YAML, run steps)**: `packages/core/src/` — add types in `types.ts`, constants in `constants.ts`, new step types in `executor.ts` and `parser.ts`.
- **CLI (commands, flags, output)**: `apps/cli/src/cli.ts`.
- **Example flows**: `examples/*.yaml`.

### Next steps (from the original plan)

- **More step types**: e.g. `http`, `script` — extend `packages/core` types and executor, then add tests.
- **MCP Server**: New app that uses `@runflow/core` and exposes “run flow” as an MCP tool.
- **GUI**: New app (e.g. Vite + React) that uses `@runflow/core` to list and run flows.

Start each of these with an OpenSpec change so the scope and tasks stay clear.

## OpenSpec

Changes are managed with OpenSpec (spec-driven workflow). See `openspec/config.yaml` and `openspec/` for changes.
