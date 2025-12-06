#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import { startHttpServer } from "./http-server.js";
import logger from "./logger.js";
import { createMcpServer } from "./mcp-server.js";

const program = new Command();

program.name("bricks").description("Bricks MCP Server").version(packageJson.version);

program
  .command("stdio")
  .description("Start MCP server in stdio mode (default)")
  .action(async () => {
    try {
      const server = createMcpServer();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info("Bricks MCP Server started (stdio mode)");
    } catch (error) {
      logger.error("Server started failed:", error);
      process.exit(1);
    }
  });

program
  .command("http")
  .description("Start MCP server in HTTP mode")
  .option("-p, --port <port>", "Port to listen on", "3000")
  .option("-h, --host <host>", "Host to bind server to", "0.0.0.0")
  .option("--path <path>", "MCP endpoint path", "/mcp")
  .option("--allowed-hosts <hosts>", "Comma-separated list of allowed hosts")
  .option("--unguessable-url", "Generate an unguessable URL path prefix for security", false)
  .action(
    async (options: {
      port: string;
      host: string;
      path: string;
      allowedHosts?: string;
      unguessableUrl: boolean;
    }) => {
      try {
        const port = parseInt(options.port, 10);
        if (Number.isNaN(port) || port < 1 || port > 65535) {
          throw new Error(`Invalid port: ${options.port}`);
        }

        const allowedHosts = options.allowedHosts
          ? options.allowedHosts.split(",").map((h: string) => h.trim())
          : undefined;

        await startHttpServer({
          port,
          host: options.host,
          path: options.path,
          allowedHosts,
          unguessableUrl: options.unguessableUrl,
        });
      } catch (error) {
        logger.error("Failed to start HTTP server:", error);
        process.exit(1);
      }
    }
  );

const args = process.argv.slice(2);

if (args.length === 0) {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((error) => {
    logger.error("Server started failed:", error);
    process.exit(1);
  });
  logger.info("Bricks MCP Server started (stdio mode)");
} else {
  program.parse();
}
