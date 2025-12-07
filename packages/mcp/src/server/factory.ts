import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import packageJson from "../../package.json";
import type { IConnectionChangeCallback } from "../client";
import { McpClientManager } from "../client";
import { registerPrompts } from "../prompts";
import { ResourceManager, registerResources } from "../resources";
import { registerTools } from "../tools";
import type { McpConfigType } from "../utils";
import { logger } from "../utils";

export interface IMcpServerInstance {
  server: McpServer;
  resourceManager: ResourceManager;
  clientManager?: McpClientManager;
}

export interface ICreateMcpServerOptions {
  config?: McpConfigType;
  clientManager?: McpClientManager;
}

function initializeClientConnections(
  config: McpConfigType,
  resourceManager: ResourceManager
): McpClientManager {
  const changeCallback: IConnectionChangeCallback = {
    onConnectionsChanged: () => {
      resourceManager.notifyResourceListChanged();
    },
  };

  const clientManager = new McpClientManager(changeCallback);
  clientManager.connectAll(config);
  resourceManager.setClientManager(clientManager);

  const connections = clientManager.getAllConnections();
  logger.info(`Connected to ${connections.length} MCP server(s)`);
  return clientManager;
}

export async function createMcpServerInstance(
  options?: ICreateMcpServerOptions
): Promise<IMcpServerInstance> {
  const server = new McpServer({
    name: `${packageJson.name}-server`,
    version: packageJson.version,
  });

  const resourceManager = new ResourceManager(server);

  let clientManager: McpClientManager | undefined = options?.clientManager;

  if (options?.config && !clientManager) {
    clientManager = initializeClientConnections(options.config, resourceManager);
  }

  registerTools(server);
  registerResources(resourceManager);
  registerPrompts(server);

  if (clientManager) {
    resourceManager.setClientManager(clientManager);
  }

  return {
    server,
    resourceManager,
    clientManager,
  };
}
