import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import packageJson from "../package.json";
import { McpClientManager } from "./client";
import { EventBus } from "./events";
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";
import { registerTools } from "./tools";
import type { McpConfigType } from "./utils";
import { logger } from "./utils";
import { WorkflowManager } from "./workflow";

export interface IMcpServerInstance {
  server: McpServer;
  clientManager: McpClientManager;
}

export interface ICreateMcpServerOptions {
  config?: McpConfigType;
  flowsPath?: string;
}

export async function createMcpInstance(
  options?: ICreateMcpServerOptions
): Promise<IMcpServerInstance> {
  const eventBus = EventBus.getInstance();

  const server = new McpServer({
    name: `${packageJson.name}-server`,
    version: packageJson.version,
  });

  const clientManager = new McpClientManager(eventBus);
  const workflowManager = await WorkflowManager.create({
    flowsPath: options?.flowsPath,
    clientManager,
  });

  if (options?.config) {
    clientManager
      .connectAll(options.config)
      .then(() => {
        const connections = clientManager.getAllConnections();
        logger.info(`Connected to ${connections.length} MCP server(s)`);
      })
      .catch((error) => {
        logger.error("Failed to initialize client connections:", error);
      });
  }
  registerTools(server, clientManager, workflowManager);
  registerResources(server, clientManager, eventBus);
  registerPrompts(server);

  return {
    server,
    clientManager,
  };
}
