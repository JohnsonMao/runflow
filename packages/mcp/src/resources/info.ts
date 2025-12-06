import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

export const registerInfoResource = (server: McpServer): void => {
  server.registerResource(
    "info",
    "bricks://info",
    {
      title: "Bricks MCP Info",
      description: "Basic information about Bricks MCP Server",
      mimeType: "text/plain",
    },
    async (): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: "bricks://info",
            mimeType: "text/plain",
            text: `Bricks MCP Server v0.1.0

A composable MCP Server that integrates Server and Client capabilities.

Features:
- Tool invocation (Tools)
- Resource provisioning (Resources)
- MCP Client functionality (connect to other MCP Servers)
- Modular design

Welcome!`,
          },
        ],
      };
    }
  );
};
