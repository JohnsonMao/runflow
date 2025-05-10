import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RegisterToolType } from "./type";
import type Context from "../context";

import * as getCommitMessage from "./getCommitMessage";

const tools = {
  ...getCommitMessage,
};

export default function registerTools(server: McpServer, context: Context) {
  Object.values(tools).forEach((registerTool: RegisterToolType) =>
    registerTool(server.tool.bind(server), context)
  );
}
