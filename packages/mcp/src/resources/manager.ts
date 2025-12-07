import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpClientManager } from "../client";

export type IResourceHandler = (clientManager?: McpClientManager) => Promise<ReadResourceResult>;

export interface IResourceMetadata {
  title: string;
  description: string;
  mimeType: string;
}

export class ResourceManager {
  private server: McpServer;
  private registeredResources: Map<string, IResourceHandler> = new Map();
  private clientManager?: McpClientManager;

  constructor(server: McpServer) {
    this.server = server;
  }

  setClientManager(clientManager?: McpClientManager): void {
    this.clientManager = clientManager;
  }

  registerResource(
    name: string,
    uri: string,
    metadata: IResourceMetadata,
    handler: IResourceHandler
  ): void {
    if (this.registeredResources.has(uri)) {
      return;
    }

    this.registeredResources.set(uri, handler);

    this.server.registerResource(name, uri, metadata, async () => {
      const storedHandler = this.registeredResources.get(uri);
      if (!storedHandler) {
        throw new Error(`Resource handler not found for URI: ${uri}`);
      }
      return storedHandler(this.clientManager);
    });
  }

  hasResource(uri: string): boolean {
    return this.registeredResources.has(uri);
  }

  notifyResourceListChanged(): void {
    this.server.sendResourceListChanged();
  }

  getRegisteredResourceUris(): string[] {
    return Array.from(this.registeredResources.keys());
  }
}
