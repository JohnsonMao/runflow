# Bricks MCP

A composable MCP Server that integrates Server and Client capabilities, can also run independently.

## Installation

```bash
pnpm install
```

## Build

```bash
pnpm build
```

## Run

```bash
pnpm start
```

## Development Mode

```bash
pnpm dev
```

## Connection Methods

### Connect in Cursor

#### Method 1: Using npx (Recommended for development)

Add to Cursor's configuration file (e.g., `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "bricks": {
      "command": "npx",
      "args": ["-y", "@bricks/mcp"]
    }
  }
}
```

**Advantages:**
- ✅ No global installation required
- ✅ Automatically uses the latest version
- ✅ Suitable for development and testing

#### Method 2: Use after global installation (Suitable for production)

```bash
# Install
pnpm add -g @bricks/mcp
# or
npm install -g @bricks/mcp
```

```json
{
  "mcpServers": {
    "bricks": {
      "command": "bricks"
    }
  }
}
```

**Advantages:**
- ✅ Fast execution
- ✅ Stable version
- ✅ Suitable for production environment

#### Method 3: Local development (Direct path specification)

```json
{
  "mcpServers": {
    "bricks": {
      "command": "node",
      "args": ["/path/to/bricks/packages/mcp/dist/index.js"]
    }
  }
}
```

### Connect in Claude Desktop

Add to Claude Desktop's configuration file (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json`):

**Using npx:**

```json
{
  "mcpServers": {
    "bricks": {
      "command": "npx",
      "args": ["-y", "@bricks/mcp"]
    }
  }
}
```

**Or after global installation:**

```json
{
  "mcpServers": {
    "bricks": {
      "command": "bricks"
    }
  }
}
```

## Available Tools

### greet
Greet the user

Parameters:
- `name` (string, required): The user's name

### echo
Echo back the input text

Parameters:
- `message` (string, required): The message to echo back

## Available Resources

### bricks://info
Basic information about Bricks MCP Server

