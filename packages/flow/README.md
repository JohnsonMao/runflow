# @bricks/flow

Flow execution engine for YAML-based workflow definitions.

## Installation

```bash
pnpm add @bricks/flow
```

## Usage

### Loading Flows

```typescript
import { createFlowLoader } from "@bricks/flow";

const loader = createFlowLoader("./flows", { recursive: true });
const flows = await loader.loadAll();
```

### Parsing Flow

```typescript
import { parseFlow } from "@bricks/flow";

const yamlContent = `
id: "my-flow"
name: "My Flow"
nodes: []
connections: {}
`;

const flow = parseFlow(yamlContent);
```

## Features

- YAML parsing and validation
- Flow loading from file system
- Type-safe Flow definitions
- Support for multiple trigger types (schedule, webhook, mcpTool)

## Development

```bash
# Build
pnpm build

# Development mode
pnpm dev

# Lint
pnpm lint
```
