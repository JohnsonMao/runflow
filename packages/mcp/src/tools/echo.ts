import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

export const registerEchoTool = (server: McpServer): void => {
  server.registerTool(
    "echo",
    {
      title: "Echo Tool",
      description: "Echo back the input text",
      inputSchema: {
        message: z.string().describe("The message to echo back"),
      },
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    }
  );
};
