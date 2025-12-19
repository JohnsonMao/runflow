import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpClientManager } from "../client";
import type { WorkflowManager } from "../workflow";
import { registerDiscoverTool } from "./discover";
import { registerExecuteTool } from "./execute";

export const registerTools = (
  server: McpServer,
  clientManager: McpClientManager,
  workflowManager: WorkflowManager
): void => {
  registerDiscoverTool(server, clientManager, workflowManager);
  registerExecuteTool(server, clientManager, workflowManager);
};
