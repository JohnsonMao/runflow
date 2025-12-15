import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import z from "zod";

export const registerGreetingPrompt = (server: McpServer): void => {
  server.registerPrompt(
    "greeting-prompt",
    {
      title: "Greeting Prompt",
      description: "Generate a personalized greeting message",
      argsSchema: {
        name: z.string().describe("The user's name"),
        timeOfDay: z.enum(["morning", "afternoon", "evening"]).optional().describe("Time of day"),
      },
    },
    async ({ name, timeOfDay }) => {
      const timeGreeting = {
        morning: "Good morning",
        afternoon: "Good afternoon",
        evening: "Good evening",
      };

      const greeting = timeOfDay ? timeGreeting[timeOfDay] : "Hello";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `${greeting}, ${name}! Welcome to Bricks MCP Server.`,
            },
          },
        ],
      };
    }
  );
};
