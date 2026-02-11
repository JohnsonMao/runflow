# Runflow MCP Server

MCP (Model Context Protocol) server that exposes Runflow as tools over stdio. Use it from Cursor or other MCP clients to run flow files without the CLI.

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

The server uses **stdio** transport: it reads JSON-RPC from stdin and writes responses to stdout. MCP clients spawn this process and connect via stdio.

## Tools

- **run_flow** – Run a flow YAML file.
  - **flowPath** (required): Path to the flow file (absolute or relative to process cwd).
  - **params** (optional): Object of initial parameters for the flow.

  Result is returned as text: success summary or error message (and step id when a step fails).

- **list_flows** – List flow files in a directory (recursive).
  - **directory** (optional): Directory to search, relative to cwd. Default: current working directory.
  - **extension** (optional): `yaml` | `yml` | `both`. Default: `yaml`.

  Returns a JSON array of `{ path, name, description? }` for each valid flow file found. Skips `node_modules` and dot-directories.

## Cursor MCP configuration

Add the Runflow MCP server in Cursor settings (e.g. **Settings → MCP** or `.cursor/mcp.json` depending on your setup). Example using the built app from the repo root:

**Command:** `node`  
**Args:** `apps/mcp-server/dist/index.js`

Or with pnpm from the repo root:

**Command:** `pnpm`  
**Args:** `--filter`, `@runflow/mcp-server`, `start`

Ensure the **cwd** is the repo root (or the directory your flow paths are relative to).

## Development

- Build: `pnpm --filter @runflow/mcp-server build`
- Watch: `pnpm --filter @runflow/mcp-server dev`
- Typecheck: `pnpm --filter @runflow/mcp-server typecheck`
