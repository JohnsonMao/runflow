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

### @bricks/core

Core interfaces and types for the Bricks workflow system.

For detailed documentation, see [packages/core/README.md](./packages/core/README.md)

### @bricks/flow

Flow execution engine for YAML-based workflow definitions.

For detailed documentation, see [packages/flow/README.md](./packages/flow/README.md)

### @bricks/nodes

Node executors for the Bricks workflow system, including built-in nodes: `set`, `code`, `if`, and `mcpTool`.

For detailed documentation, see [packages/nodes/README.md](./packages/nodes/README.md)

### @bricks/mcp

MCP Server that integrates Server and Client capabilities, providing tools, resources, and workflow orchestration functionality.

For detailed documentation, see [packages/mcp/README.md](./packages/mcp/README.md)

## MVP Goals

Currently completed:

- ✅ Tools (Tools) - `discover` (search tools and workflows)
- ✅ Resources (Resources) - `bricks://info`
- ✅ Prompts (Prompts) - `greeting-prompt`
- ✅ Standard MCP protocol connection support
- ✅ Workflow orchestration functionality
- ✅ YAML workflow definitions
- ✅ Extend `discover` to include workflows

Next steps:
- [ ] Support for composing multiple MCP Servers
