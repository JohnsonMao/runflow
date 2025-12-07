import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import http from "node:http";
import type net from "node:net";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpConfigType } from "../utils";
import { logger } from "../utils";
import { createMcpServerInstance } from "./factory";

export interface IHttpServerOptions {
  port: number;
  host?: string;
  path?: string;
  allowedHosts?: string[];
  unguessableUrl?: boolean;
  config?: McpConfigType;
}

function httpAddressToString(address: string | net.AddressInfo | null): string {
  if (!address) {
    throw new Error("Could not bind server socket");
  }
  if (typeof address === "string") {
    return address;
  }
  const resolvedPort = address.port;
  let resolvedHost = address.family === "IPv4" ? address.address : `[${address.address}]`;
  if (resolvedHost === "0.0.0.0" || resolvedHost === "[::]") {
    resolvedHost = "localhost";
  }
  return `http://${resolvedHost}:${resolvedPort}`;
}

function decorateServer(server: net.Server): void {
  const sockets = new Set<net.Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });

  const close = server.close;
  server.close = (callback?: (err?: Error) => void) => {
    for (const socket of sockets) {
      socket.destroy();
    }
    sockets.clear();
    return close.call(server, callback);
  };
}

export async function startHttpServer(options: IHttpServerOptions): Promise<http.Server> {
  const { port, host = "0.0.0.0", path, allowedHosts, unguessableUrl = false, config } = options;

  const pathPrefix = unguessableUrl ? `/${crypto.randomUUID()}` : "";

  const instance = await createMcpServerInstance({ config });

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer();
  decorateServer(httpServer);

  let resolvedAllowedHosts: string[];
  if (allowedHosts) {
    resolvedAllowedHosts = allowedHosts.map((h) => h.toLowerCase());
  } else if (host === "0.0.0.0" || host === "[::]") {
    resolvedAllowedHosts = ["localhost", "127.0.0.1", "[::1]"];
  } else {
    resolvedAllowedHosts = [host.toLowerCase()];
  }
  const allowAnyHost = resolvedAllowedHosts.includes("*");

  httpServer.on("request", async (req: IncomingMessage, res: ServerResponse) => {
    if (!allowAnyHost) {
      const requestHost = req.headers.host?.toLowerCase();
      if (!requestHost) {
        res.statusCode = 400;
        return res.end("Missing host");
      }

      const requestHostWithoutPort = requestHost.split(":")[0];
      const isAllowed = resolvedAllowedHosts.some((allowedHost) => {
        const allowedHostWithoutPort = allowedHost.split(":")[0];
        return requestHost === allowedHost || requestHostWithoutPort === allowedHostWithoutPort;
      });

      if (!isAllowed) {
        res.statusCode = 403;
        return res.end(`Access is only allowed at ${resolvedAllowedHosts.join(", ")}`);
      }
    }

    if (!req.url?.startsWith(pathPrefix + path)) {
      if (req.url === "/health") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ status: "ok", service: "bricks-mcp" }));
      }
      res.statusCode = 404;
      return res.end("Not found");
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const transport = sessions.get(sessionId);
      if (!transport) {
        res.statusCode = 404;
        res.end("Session not found");
        return;
      }
      return await transport.handleRequest(req, res);
    }

    if (req.method === "POST") {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: async (sessionId) => {
          logger.debug(`create http session: ${sessionId}`);
          await instance.server.connect(transport);
          sessions.set(sessionId, transport);
        },
      });

      transport.onclose = () => {
        if (!transport.sessionId) {
          return;
        }
        sessions.delete(transport.sessionId);
        logger.debug(`delete http session: ${transport.sessionId}`);
      };

      await transport.handleRequest(req, res);
      return;
    }

    res.statusCode = 400;
    res.end("Invalid request");
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.on("error", reject);
    httpServer.listen(port, host, () => {
      resolve();
      httpServer.removeListener("error", reject);
    });
  });

  const serverUrl = httpAddressToString(httpServer.address());
  const fullServerUrl = `${serverUrl}${pathPrefix}${path}`;

  logger.info("Bricks MCP Server started (HTTP mode)");
  logger.info(`Server listening on ${fullServerUrl}`);
  logger.info(`Health check available at ${serverUrl}/health`);

  const shutdown = async () => {
    logger.info("Shutting down HTTP server...");
    if (instance.clientManager) {
      await instance.clientManager.disconnectAll();
    }
    httpServer.close(() => {
      logger.info("HTTP server closed");
      sessions.clear();
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return httpServer;
}
