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

### Stdio Mode (Default)

```bash
pnpm start
# or
bricks stdio
```

### HTTP Mode

Start the server in HTTP mode for development:

```bash
pnpm dev
# or directly run
tsx src/http.ts
```

You can configure the server using environment variables:

```bash
MCP_PORT=3000 MCP_HOST=0.0.0.0 MCP_PATH=/mcp pnpm dev
```

The server will be available at:
- MCP endpoint: `http://localhost:3000/mcp`
- Health check: `http://localhost:3000/health`

## Development Mode

```bash
pnpm dev
```

## Transport Modes

This MCP server supports two transport modes:

1. **Stdio Mode** (default): Uses standard input/output for communication
   - Suitable for local development and integration with MCP clients
   - Used by Cursor, Claude Desktop, and other MCP clients

2. **HTTP Mode**: Uses Streamable HTTP protocol
   - Suitable for remote access and web integration
   - Supports stateless request handling
   - Can be accessed via HTTP clients

## Connection Methods

### Connect via HTTP (for development/testing)

You can connect to the HTTP server using any HTTP client:

```bash
# Health check
curl http://localhost:3000/health

# MCP request (example)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

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

### generate-image
Generate a simple SVG image based on text description, returns base64 encoded

Parameters:
- `text` (string, required): The text to display in the image
- `width` (number, optional): Image width (default: 400)
- `height` (number, optional): Image height (default: 200)

## Available Resources

### bricks://info
Basic information about Bricks MCP Server

## Available Prompts

### greeting-prompt
Generate a personalized greeting message

Parameters:
- `name` (string, required): The user's name
- `timeOfDay` (enum, optional): Time of day - "morning", "afternoon", or "evening"

