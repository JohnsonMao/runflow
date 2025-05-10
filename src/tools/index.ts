import z from "zod";
import type { RegisterToolsPropsType, ToolProps } from "../type";

import * as gitTools from "./git";

const tools = {
  ...gitTools,
};

export default function registerTools({
  server,
  context,
  result,
}: RegisterToolsPropsType) {
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
