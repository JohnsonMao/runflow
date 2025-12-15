import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { logger } from "../utils";

export interface IStdioServerOptions {
  server: McpServer;
}

export async function startStdioServer(options: IStdioServerOptions): Promise<void> {
  const { server } = options;
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Bricks MCP Server started (stdio mode)");
}
