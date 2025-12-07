import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger, type McpConfigType } from "../utils";
import { createMcpServerInstance } from "./factory";

export interface IStdioServerOptions {
  config?: McpConfigType;
  scriptPath?: string;
}

export async function startStdioServer(options?: IStdioServerOptions): Promise<void> {
  const transport = new StdioServerTransport();
  const instance = await createMcpServerInstance({ config: options?.config });
  await instance.server.connect(transport);
  logger.info("Bricks MCP Server started (stdio mode)");
}
