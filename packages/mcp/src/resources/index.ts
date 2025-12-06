import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerInfoResource } from "./info.js";

export const registerResources = (server: McpServer): void => {
  registerInfoResource(server);
};
