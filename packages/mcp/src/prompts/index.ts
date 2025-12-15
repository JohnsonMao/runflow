import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { registerGreetingPrompt } from "./greeting";

export const registerPrompts = (server: McpServer): void => {
  registerGreetingPrompt(server);
};
