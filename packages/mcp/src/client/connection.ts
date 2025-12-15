import { Client } from "@modelcontextprotocol/sdk/client/index";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import packageJson from "../../package.json";
import type { McpServerConfigType } from "../utils";
import { logger } from "../utils";

export interface IMcpClientConnection {
  name: string;
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport;
}

const CONNECTION_TIMEOUT = 30000;

async function connectWithTimeout<T>(connectPromise: Promise<T>, serverName: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `Connection to MCP server "${serverName}" timed out after ${CONNECTION_TIMEOUT}ms`
        )
      );
    }, CONNECTION_TIMEOUT);
  });

  return Promise.race([connectPromise, timeoutPromise]);
}

export async function createMcpClient(
  name: string,
  config: McpServerConfigType
): Promise<IMcpClientConnection> {
  const client = new Client({
    name: `${packageJson.name}-client-${name}`,
    version: packageJson.version,
  });

  if ("url" in config) {
    const transport = new StreamableHTTPClientTransport(new URL(config.url));
    await connectWithTimeout(client.connect(transport), name);
    logger.info(`Connected to MCP server "${name}" via HTTP: ${config.url}`);

    return {
      name,
      client,
      transport,
    };
  }

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args || [],
    env: config.env,
  });

  await connectWithTimeout(client.connect(transport), name);
  logger.info(`Connected to MCP server "${name}" via stdio: ${config.command}`);

  return {
    name,
    client,
    transport,
  };
}

export async function disconnectMcpClient(connection: IMcpClientConnection): Promise<void> {
  try {
    await connection.client.close();
    logger.info(`Disconnected from MCP server "${connection.name}"`);
  } catch (error) {
    logger.error(`Error disconnecting from MCP server "${connection.name}":`, error);
  }
}
