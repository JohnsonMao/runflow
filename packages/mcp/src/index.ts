#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import packageJson from "../package.json" with { type: "json" };
import logger from "./logger.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";

async function main() {
  const server = new McpServer({
    name: packageJson.name,
    version: packageJson.version,
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Bricks MCP Server started");
}

main().catch((error) => {
  logger.error("Server started failed:", error);
  process.exit(1);
});
