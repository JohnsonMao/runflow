import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

export const registerGenerateImageTool = (server: McpServer): void => {
  server.registerTool(
    "generate-image",
    {
      title: "Generate Image Tool",
      description: "Generate a simple SVG image based on text description, returns base64 encoded",
      inputSchema: {
        text: z.string().describe("The text to display in the image"),
        width: z.number().optional().default(400).describe("Image width"),
        height: z.number().optional().default(200).describe("Image height"),
      },
    },
    async ({ text, width = 400, height = 200 }) => {
      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#4F46E5"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">${text}</text>
</svg>`;

      const base64Svg = Buffer.from(svg).toString("base64");

      return {
        content: [
          {
            type: "text" as const,
            text: `Image generated: ${text}`,
          },
          {
            type: "image" as const,
            data: base64Svg,
            mimeType: "image/svg+xml",
          },
        ],
      };
    }
  );
};
