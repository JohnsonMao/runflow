import { registerInfoResource } from "./info";
import type { ResourceManager } from "./manager";
import { registerMcpStatusResource } from "./mcp-status";

export const registerResources = (resourceManager: ResourceManager): void => {
  registerInfoResource(resourceManager);
  registerMcpStatusResource(resourceManager);
};

export type { IResourceHandler, IResourceMetadata } from "./manager";
export { ResourceManager } from "./manager";
