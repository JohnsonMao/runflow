import z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolProps } from "./type";
import type Context from "../context";
import type Result from "../result";

import * as generateCommitMessage from "./generateCommitMessage";

const tools = {
  ...generateCommitMessage,
};

export default function registerTools(
  server: McpServer,
  context: Context,
  result: Result
) {
  Object.values(tools).forEach((registerTool) => {
    const tool = <T extends z.ZodRawShape = z.ZodRawShape>({
      name,
      description,
      schema,
      handler,
    }: ToolProps<T>) => {
      server.tool.call(
        server,
        name,
        description,
        schema?.shape ?? {},
        async (props) => (await handler(props as T)).getResult()
      );
    };

    registerTool({ tool, context, result });
  });
}
