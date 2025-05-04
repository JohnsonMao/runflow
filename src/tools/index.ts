import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterToolType } from "./type";

import * as getCommitMessage from "./getCommitMessage";
import * as memoryTools from "./memoryTools";

const tools = {
  ...getCommitMessage,
  ...memoryTools,
};

export default function registerTools(server: McpServer) {
  Object.values(tools).forEach((registerTool: RegisterToolType) =>
    registerTool(server.tool.bind(server))
  );
}
