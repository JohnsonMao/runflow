import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateFlowPrompt } from "./create-flow";

export const registerPrompts = (server: McpServer): void => {
  registerCreateFlowPrompt(server);
};
