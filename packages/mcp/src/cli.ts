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
  .option(
    "--watch",
    "Enable file watching and hot reload for workspace flow files"
  )
  .action(async (options: { config?: string; workspace?: string; watch?: boolean }) => {
    try {
      const config = options.config ? loadConfig(options.config) : undefined;
      const { server, workflowManager } = await createMcpInstance({
        config,
        workspacePath: options.workspace,
        watch: options.watch,
      });

      const shutdown = () => {
        workflowManager.dispose();
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);

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
  .option(
    "--watch",
    "Enable file watching and hot reload for workspace flow files"
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
      watch?: boolean;
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

        const globalWatch = globalOptions.watch as boolean | undefined;
        const { server, clientManager, workflowManager } = await createMcpInstance({
          config,
          workspacePath,
          watch: options.watch || globalWatch,
        });

        await startHttpServer({
          server,
          port,
          host: options.host,
          path: options.path,
          allowedHosts,
          unguessableUrl: options.unguessableUrl,
          onShutdown: async () => {
            workflowManager.dispose();
            clientManager.disconnectAll();
          },
        });
      } catch (error) {
        logger.error("Failed to start HTTP server:", error);
        process.exit(1);
      }
    }
  );

program.parse();
