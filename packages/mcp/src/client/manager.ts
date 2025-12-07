import { ClientEvent, type IEventBus } from "../events";
import type { McpConfigType } from "../utils";
import { logger } from "../utils";
import { createMcpClient, disconnectMcpClient, type IMcpClientConnection } from "./connection";

export interface IServerStatus {
  name: string;
  status: "connected" | "failed" | "disconnected";
  error?: string;
}

export class McpClientManager {
  private connections: Map<string, IMcpClientConnection> = new Map();
  private serverStatuses: Map<string, IServerStatus> = new Map();
  private config?: McpConfigType;
  private eventBus: IEventBus;

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  async connectAll(config: McpConfigType): Promise<void> {
    this.config = config;

    const connectionPromises = Object.entries(config.mcpServers).map(
      async ([name, serverConfig]) => {
        try {
          const connection = await createMcpClient(name, serverConfig);
          this.connections.set(name, connection);
          this.serverStatuses.set(name, {
            name,
            status: "connected",
          });
          this.eventBus.emit(ClientEvent.CONNECTION_ADDED, { name });
          return { name, success: true as const };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to connect to MCP server "${name}":`, error);
          this.serverStatuses.set(name, {
            name,
            status: "failed",
            error: errorMessage,
          });
          return { name, success: false as const, error };
        }
      }
    );

    const results = await Promise.all(connectionPromises);

    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    if (successful > 0) {
      logger.info(`Successfully connected to ${successful} MCP server(s)`);
    }
    if (failed > 0) {
      logger.warn(`Failed to connect to ${failed} MCP server(s)`);
    }

    if (successful > 0) {
      this.eventBus.emit(ClientEvent.CONNECTIONS_CHANGED);
    }
  }

  async disconnectAll(): Promise<void> {
    const connectionNames = Array.from(this.connections.keys());
    const disconnectPromises = Array.from(this.connections.values()).map((connection) =>
      disconnectMcpClient(connection)
    );
    await Promise.all(disconnectPromises);
    this.connections.clear();

    for (const name of connectionNames) {
      const status = this.serverStatuses.get(name);
      if (status) {
        this.serverStatuses.set(name, {
          ...status,
          status: "disconnected",
        });
      }
      this.eventBus.emit(ClientEvent.CONNECTION_REMOVED, { name });
    }

    if (connectionNames.length > 0) {
      this.eventBus.emit(ClientEvent.CONNECTIONS_CHANGED);
    }
  }

  getConnection(name: string): IMcpClientConnection | undefined {
    return this.connections.get(name);
  }

  getAllConnections(): IMcpClientConnection[] {
    return Array.from(this.connections.values());
  }

  hasConnection(name: string): boolean {
    return this.connections.has(name);
  }

  getAllServerStatuses(): IServerStatus[] {
    if (!this.config) {
      return [];
    }

    const allServerNames = Object.keys(this.config.mcpServers);
    return allServerNames.map((name) => {
      const status = this.serverStatuses.get(name);
      if (status) {
        return status;
      }
      return {
        name,
        status: "disconnected" as const,
      };
    });
  }

  getConfig(): McpConfigType | undefined {
    return this.config;
  }
}
