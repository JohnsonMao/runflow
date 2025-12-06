import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { Request, Response } from "express";
import logger from "./logger.js";
import { createMcpServer } from "./mcp-server.js";

interface HttpServerOptions {
  port?: number;
  host?: string;
  path?: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PATH = "/mcp";

export async function startHttpServer(options: HttpServerOptions = {}): Promise<void> {
  const port = options.port ?? Number.parseInt(process.env.MCP_PORT || String(DEFAULT_PORT), 10);
  const host = options.host ?? (process.env.MCP_HOST || DEFAULT_HOST);
  const path = options.path ?? (process.env.MCP_PATH || DEFAULT_PATH);

  const app = createMcpExpressApp();

  app.post(path, async (req: Request, res: Response) => {
    try {
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
        server.close();
      });
    } catch (error) {
      logger.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  app.get(path, async (_req: Request, res: Response) => {
    logger.debug("Received GET MCP request");
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    });
  });

  app.delete(path, async (_req: Request, res: Response) => {
    logger.debug("Received DELETE MCP request");
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "bricks-mcp" });
  });

  app.listen(port, host, () => {
    logger.info(`Bricks MCP Server started (HTTP mode)`);
    logger.info(`Server listening on http://${host}:${port}${path}`);
    logger.info(`Health check available at http://${host}:${port}/health`);
  });

  process.on("SIGINT", () => {
    logger.info("Shutting down HTTP server...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Shutting down HTTP server...");
    process.exit(0);
  });
}

