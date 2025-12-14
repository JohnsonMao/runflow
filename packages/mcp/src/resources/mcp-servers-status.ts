import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpClientManager } from "../client";
import type { ResourceManager } from "./manager";

export const registerMcpStatusResource = (resourceManager: ResourceManager): void => {
  resourceManager.registerResource(
    "mcp-servers-status",
    "bricks://mcp-servers-status",
    {
      title: "MCP Servers Status",
      description: "List of all configured MCP servers and their connection status",
      mimeType: "text/plain",
    },
    async (currentClientManager?: McpClientManager): Promise<ReadResourceResult> => {
      if (!currentClientManager) {
        return {
          contents: [
            {
              uri: "bricks://mcp-servers-status",
              mimeType: "text/plain",
              text: "MCP Servers Status:\n(none)",
            },
          ],
        };
      }

      const serverStatuses = currentClientManager.getAllServerStatuses();

      const serversText =
        serverStatuses.length > 0
          ? serverStatuses
              .map((s) => {
                const statusLine = `- ${s.name}: ${s.status}`;
                return s.error ? `${statusLine} (${s.error})` : statusLine;
              })
              .join("\n")
          : "(none)";

      return {
        contents: [
          {
            uri: "bricks://mcp-servers-status",
            mimeType: "text/plain",
            text: `MCP Servers Status:\n${serversText}`,
          },
        ],
      };
    }
  );
};
