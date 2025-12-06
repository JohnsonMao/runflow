#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import logger from "./logger.js";
import { createMcpServer } from "./mcp-server.js";

async function main() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Bricks MCP Server started (stdio mode)");
}

main().catch((error) => {
  logger.error("Server started failed:", error);
  process.exit(1);
});
