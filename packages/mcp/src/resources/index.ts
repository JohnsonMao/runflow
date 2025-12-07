import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { McpClientManager } from "../client";
import type { IEventBus } from "../events";
import { registerInfoResource } from "./info";
import { ResourceManager } from "./manager";
import { registerMcpStatusResource } from "./mcp-status";

export const registerResources = (
  server: McpServer,
  eventBus: IEventBus,
  clientManager: McpClientManager
) => {
  const resourceManager = new ResourceManager(server, eventBus, clientManager);
  registerInfoResource(resourceManager);
  registerMcpStatusResource(resourceManager);
};
