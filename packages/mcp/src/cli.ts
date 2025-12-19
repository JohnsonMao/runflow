#!/usr/bin/env node

import { Command } from "commander";
import packageJson from "../package.json";
import { createMcpInstance } from "./main";
import { startHttpServer, startStdioServer } from "./server";
import { loadConfig, logger } from "./utils";

const program = new Command();

program
  .name("bricks")
  .description("Bricks MCP Server (default: stdio mode)")
  .version(packageJson.version)
  .option(
    "--config <path>",
    "Load MCP config file (mcp.json format) to connect to other MCP servers"
  )
  .option(
    "--workspace <path>",
    "Load workspace directory containing flows, tools, prompts, resources, and nodes subdirectories"
  )
  .action(async (options: { config?: string; workspace?: string }) => {
    try {
      const config = options.config ? loadConfig(options.config) : undefined;
      const { server } = await createMcpInstance({
        config,
        workspacePath: options.workspace,
      });
      await startStdioServer({ server });
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
  .option(
    "--config <path>",
    "Load MCP config file (mcp.json format) to connect to other MCP servers"
  )
  .option(
    "--workspace <path>",
    "Load workspace directory containing flows, tools, prompts, resources, and nodes subdirectories"
  )
  .action(
    async (options: {
      port: string;
      host: string;
      path: string;
      allowedHosts?: string;
      unguessableUrl: boolean;
      config?: string;
      workspace?: string;
    }) => {
      try {
        const globalOptions = program.opts();
        const workspacePath = options.workspace || globalOptions.workspace;

        const port = parseInt(options.port, 10);
        if (Number.isNaN(port) || port < 1 || port > 65535) {
          throw new Error(`Invalid port: ${options.port}`);
        }

        const allowedHosts = options.allowedHosts
          ? options.allowedHosts.split(",").map((h: string) => h.trim())
          : undefined;

        const config =
          options.config || globalOptions.config
            ? loadConfig((options.config || globalOptions.config)!)
            : undefined;

        const { server, clientManager } = await createMcpInstance({
          config,
          workspacePath,
        });

        await startHttpServer({
          server,
          port,
          host: options.host,
          path: options.path,
          allowedHosts,
          unguessableUrl: options.unguessableUrl,
          onShutdown: () => clientManager.disconnectAll(),
        });
      } catch (error) {
        logger.error("Failed to start HTTP server:", error);
        process.exit(1);
      }
    }
  );

program.parse();
