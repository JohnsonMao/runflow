# Bricks

A composable MCP orchestrator that integrates Server and Client capabilities, a modular workflow platform that can also run independently.

## Quick Start

### Requirements

- Node.js >= 20.0.0
- pnpm >= 8.0.0

### Install Dependencies

```bash
pnpm install
```

### Build Project

```bash
pnpm build
```

### Development Mode

```bash
pnpm dev
```

## Packages

### @bricks/mcp

Basic MCP Server that integrates Server and Client capabilities, providing tools and resources functionality.

For detailed documentation, see [packages/mcp/README.md](./packages/mcp/README.md)

## MVP Goals

Currently completed basic MCP Server with:

- ✅ Tools (Tools) - `discover` (search tools and workflows)
- ✅ Resources (Resources) - `bricks://info`
- ✅ Prompts (Prompts) - `greeting-prompt`
- ✅ Standard MCP protocol connection support

Next steps:
- [ ] Support for composing multiple MCP Servers
- [ ] Workflow orchestration functionality
- [ ] YAML workflow definitions
- [x] Extend `discover` to include workflows
