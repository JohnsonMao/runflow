import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpClientManager } from "../client";
import type { ResourceManager } from "./manager";

export const registerMcpStatusResource = (resourceManager: ResourceManager): void => {
  resourceManager.registerResource(
    "mcp-servers",
    "bricks://mcp-servers",
    {
      title: "MCP Servers",
      description: "List of all configured MCP servers and their connection status",
      mimeType: "application/json",
    },
    async (currentClientManager?: McpClientManager): Promise<ReadResourceResult> => {
      if (!currentClientManager) {
        return {
          contents: [
            {
              uri: "bricks://mcp-servers",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  configured: false,
                  connected: 0,
                  failed: 0,
                  servers: [],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const serverStatuses = currentClientManager.getAllServerStatuses();
      const connectedCount = serverStatuses.filter((s) => s.status === "connected").length;
      const failedCount = serverStatuses.filter((s) => s.status === "failed").length;

      return {
        contents: [
          {
            uri: "bricks://mcp-servers",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                configured: true,
                connected: connectedCount,
                failed: failedCount,
                servers: serverStatuses,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
};
