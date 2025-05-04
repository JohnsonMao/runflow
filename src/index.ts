import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import registerTools from "./tools";

const packageJson = require("../package.json");

// Create an MCP server
const server = new McpServer({
  name: packageJson.name,
  version: packageJson.version,
});

registerTools(server);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
(async () => await server.connect(transport))();
