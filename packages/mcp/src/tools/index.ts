import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEchoTool } from "./echo.js";
import { registerGenerateImageTool } from "./generate-image.js";
import { registerGreetTool } from "./greet.js";

export const registerTools = (server: McpServer): void => {
  registerGreetTool(server);
  registerEchoTool(server);
  registerGenerateImageTool(server);
};
