import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEchoTool } from "./echo";
import { registerGenerateImageTool } from "./generate-image";
import { registerGreetTool } from "./greet";

export const registerTools = (server: McpServer): void => {
  registerGreetTool(server);
  registerEchoTool(server);
  registerGenerateImageTool(server);
};
