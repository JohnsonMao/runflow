import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import registerTools from "./tools";
import Context from "./context";
import Result from "./result";
import { ProgramOptionsType } from "./type";

async function main() {
  const packageJson = require("../package.json");

  const server = new McpServer({
    name: packageJson.name,
    version: packageJson.version,
  });

  const context = new Context();
  const result = new Result([], false);

  registerTools({ server, context, result });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("Frontend AI MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
