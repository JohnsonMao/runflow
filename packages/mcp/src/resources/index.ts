import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { McpClientManager } from "../client";
import type { IEventBus } from "../events";
import { ResourceManager } from "./manager";
import { registerMcpStatusResource } from "./mcp-servers-status";

export const registerResources = (
  server: McpServer,
  clientManager: McpClientManager,
  eventBus: IEventBus
) => {
  const resourceManager = new ResourceManager(server, eventBus, clientManager);
  registerMcpStatusResource(resourceManager);
};
