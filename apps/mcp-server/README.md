# Runflow MCP Server

MCP (Model Context Protocol) server that exposes Runflow as tools over stdio. Use it from Cursor or other MCP clients to run flow files without the CLI. Supports the same **flowId** and **runflow.config** as the CLI (flowsDir, prefix-keyed openapi, optional handlers).

## Install

From the repo root:

```bash
pnpm install
pnpm --filter @runflow/mcp-server build
```

## Start

From the repo root after building:

```bash
pnpm --filter @runflow/mcp-server start
```

Or run the built entry directly (from repo root so relative flow paths resolve):

```bash
node apps/mcp-server/dist/index.js
```

To use a specific config file:

```bash
node apps/mcp-server/dist/index.js --config ./runflow.config.mjs
```

Config is resolved from `--config` or `runflow.config.mjs` / `runflow.config.js` in the current working directory.

The server uses **stdio** transport: it reads JSON-RPC from stdin and writes responses to stdout. MCP clients spawn this process and connect via stdio.

## Config (runflow.config.mjs)

Same format as the CLI:

- **flowsDir** – Directory to resolve file flowIds (relative to config file). When set, file flowIds are relative to this directory.
- **openapi** – Object keyed by prefix; each value has `specPath` and optionally `hooks`, `baseUrl`, `operationFilter`. FlowIds for OpenAPI flows are `prefix-operation` (e.g. `myApi-get-users`).
- **handlers** – Optional custom step handlers (same as CLI).

## Tools

- **execute** – Run a flow by **flowId**.
  - **flowId** (required): Either a file path (absolute or relative to config.flowsDir or cwd), or a prefix-operation string (e.g. `myApi-get-users`) when config has `openapi` for that prefix.
  - **params** (optional): Object of initial parameters for the flow.

  Result is returned as text: success summary or error message (and step id when a step fails).

  When a flow contains a **flow step** (type `flow`), the step's `flow` field is resolved as a **flowId** (workspace path or prefix-operation) using the same config, so callee flows can be any file under flowsDir or any OpenAPI flow.

- **discover** – List flows from config (flowsDir YAML files + OpenAPI-derived flows). Uses a cached catalog built when config is loaded.
  - **limit** (optional): Max number of flows to return (default **10**, max **10**).
  - **keyword** (optional): Filter by flowId, flow name, or description (case-insensitive). Omit to list all.

  Returns **Markdown** text in **list format**: each flow is a block with **flowId**, **name**, **description**, **params**. Params for API flows show only **path**, **query**, and **body** (no headers); **body** is expanded into key–value with type and description. Each param includes its description when present. **flowId** may contain slashes: for file flows it is the path relative to flowsDir (or cwd), so subdirectories yield slashes (e.g. `payment/flow.yaml`); for OpenAPI flows it is `prefix-operation`. When no flows match, returns a short message (e.g. "No flows found.").

## Cursor MCP configuration

Add the Runflow MCP server in Cursor settings (e.g. **Settings → MCP** or `.cursor/mcp.json`). Example from the repo root:

**Command:** `node`  
**Args:** `apps/mcp-server/dist/index.js`

With a config file:

**Command:** `node`  
**Args:** `apps/mcp-server/dist/index.js`, `--config`, `./runflow.config.mjs`

Or with pnpm:

**Command:** `pnpm`  
**Args:** `--filter`, `@runflow/mcp-server`, `start`

Set **cwd** to the repo root (or the directory that contains your flows and optional runflow.config.mjs).

## Development

- Build: `pnpm --filter @runflow/mcp-server build`
- Watch: `pnpm --filter @runflow/mcp-server dev`
- Typecheck: `pnpm --filter @runflow/mcp-server typecheck`
