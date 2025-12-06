import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import packageJson from "../package.json" with { type: "json" };
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: packageJson.name,
    version: packageJson.version,
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}
