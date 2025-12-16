# @bricks/nodes

Node executors for the Bricks workflow system.

## Installation

```bash
pnpm add @bricks/nodes
```

## Usage

```typescript
import { NodeRegistry, BaseNodeExecutor } from "@bricks/nodes";
import type { INodeExecutionContext, INodeExecutionResult } from "@bricks/core";

// Create a registry
const registry = createNodeRegistry();

// Register custom node executor
class MyCustomNode extends BaseNodeExecutor {
  readonly type = "myCustom";

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    // Implementation
  }
}

registry.register("myCustom", new MyCustomNode());
```

## Built-in Nodes

- `set` - Set variables
- `code` - Execute JavaScript code
- `if` - Conditional logic
- `mcpTool` - Execute MCP tools (requires `McpToolExecutorOptions`)

### Using MCP Tool Node

```typescript
import { McpToolNodeExecutor, type McpToolExecutorOptions } from "@bricks/nodes";

const options: McpToolExecutorOptions = {
  callTool: async (server, tool, args) => {
    // Your MCP tool call implementation
    return await yourMcpClient.callTool(server, tool, args);
  },
};

const mcpToolExecutor = new McpToolNodeExecutor(options);
registry.register("mcpTool", mcpToolExecutor);
```

