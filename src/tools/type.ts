import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type Context from "../context";

export type RegisterToolType = (
  tool: McpServer["tool"],
  context: Context
) => void;
