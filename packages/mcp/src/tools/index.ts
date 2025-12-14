import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpClientManager } from "../client";
import { registerDiscoverTool } from "./discover";
import { registerExecuteTool } from "./execute";

export const registerTools = (server: McpServer, clientManager: McpClientManager): void => {
  registerDiscoverTool(server, clientManager);
  registerExecuteTool(server, clientManager);
};
