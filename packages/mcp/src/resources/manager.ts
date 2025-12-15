import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types";
import type { McpClientManager } from "../client";
import { ClientEvent, type IEventBus } from "../events";

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
  private eventBus: IEventBus;

  constructor(server: McpServer, eventBus: IEventBus, clientManager: McpClientManager) {
    this.server = server;
    this.eventBus = eventBus;
    this.clientManager = clientManager;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventBus.on(ClientEvent.CONNECTIONS_CHANGED, () => {
      this.notifyResourceListChanged();
    });
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
