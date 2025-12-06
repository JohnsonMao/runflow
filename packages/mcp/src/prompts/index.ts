import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGreetingPrompt } from "./greeting.js";

export const registerPrompts = (server: McpServer): void => {
  registerGreetingPrompt(server);
};
