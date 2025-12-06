import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

export const registerGreetTool = (server: McpServer): void => {
  server.registerTool(
    "greet",
    {
      title: "Greet Tool",
      description: "Greet the user",
      inputSchema: {
        name: z.string().describe("The user's name"),
      },
    },
    async ({ name }) => {
      return {
        content: [
          {
            type: "text",
            text: `Hello, ${name}! Welcome to Bricks MCP Server.`,
          },
        ],
      };
    }
  );
};
