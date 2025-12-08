import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGreetTool } from "./greet";

export const registerTools = (server: McpServer): void => {
  registerGreetTool(server);
};
