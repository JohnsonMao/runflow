import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join, resolve } from "path";
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
  workflowManager: WorkflowManager;
}

export interface ICreateMcpServerOptions {
  config?: McpConfigType;
  workspacePath?: string;
  watch?: boolean;
}

function resolveWorkspacePath(workspacePath: string, subPath: string): string {
  const resolvedWorkspace = resolve(workspacePath);
  return join(resolvedWorkspace, subPath);
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

  const flowsPath = options?.workspacePath
    ? resolveWorkspacePath(options.workspacePath, "flows")
    : undefined;
  const workflowManager = await WorkflowManager.create({
    flowsPath,
    clientManager,
    watch: options?.watch,
  });

  const registeredFlows = workflowManager.getAllFlows();
  logger.info(`Registered ${registeredFlows.length} flow(s) as MCP tools`);

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
    workflowManager,
  };
}
