import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import http from "node:http";
import type net from "node:net";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "../utils";

export interface IHttpServerOptions {
  server: McpServer;
  port: number;
  host?: string;
  path?: string;
  allowedHosts?: string[];
  unguessableUrl?: boolean;
  onShutdown?: () => Promise<void>;
}

const localhost = ["localhost", "127.0.0.1", "0.0.0.0", "[::]", "[::1]"];

function httpAddressToString(address: string | net.AddressInfo | null): string {
  if (!address) {
    throw new Error("Could not bind server socket");
  }
  if (typeof address === "string") {
    return address;
  }
  const resolvedPort = address.port;
  let resolvedHost = address.family === "IPv4" ? address.address : `[${address.address}]`;
  if (localhost.includes(resolvedHost)) {
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
  const {
    server,
    port,
    host = "0.0.0.0",
    path,
    allowedHosts,
    unguessableUrl = false,
    onShutdown,
  } = options;

  const pathPrefix = unguessableUrl ? `/${crypto.randomUUID()}` : "";

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer();

  decorateServer(httpServer);

  let resolvedAllowedHosts: string[];
  if (allowedHosts) {
    resolvedAllowedHosts = allowedHosts.map((h) => h.toLowerCase());
  } else if (localhost.includes(host.toLowerCase())) {
    resolvedAllowedHosts = localhost;
  } else {
    resolvedAllowedHosts = [host.toLowerCase()];
  }

  httpServer.on("request", async (req: IncomingMessage, res: ServerResponse) => {
    const requestHost = req.headers.host?.toLowerCase();
    if (!requestHost) {
      res.statusCode = 400;
      return res.end("Missing host");
    }

    const isAllowed = resolvedAllowedHosts.some((allowedHost) => requestHost === allowedHost);

    if (!isAllowed) {
      res.statusCode = 403;
      return res.end("Forbidden");
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
          await server.connect(transport);
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
    await onShutdown?.();
    httpServer.close(() => {
      logger.info("HTTP server closed");
      sessions.clear();
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return httpServer;
}
