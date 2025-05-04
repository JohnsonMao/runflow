import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";

export type RegisterToolType = (tool: McpServer["tool"]) => void;
