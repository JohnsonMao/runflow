import { program } from "commander";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import registerTools from "./tools";
import Context from "./context";
import Result from "./result";
import { ProgramOptionsType } from "./type";

const packageJson = require("../package.json");

async function main(options: ProgramOptionsType) {
  try {
    const server = new McpServer({
      name: packageJson.name,
      version: packageJson.version,
    });

    const context = new Context();
    const result = new Result([], false);

    registerTools({ server, context, result, options });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("Frontend AI MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

program
  .version("Version " + packageJson.version)
  .name(packageJson.name)
  .option("--capability <capability>", "Capability to run the server on")
  .action(main);

program.parse(process.argv);
