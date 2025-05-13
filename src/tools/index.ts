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
  options,
}: RegisterToolsPropsType) {
  const capabilities = options.capability?.split(",");

  Object.values(tools).forEach((registerTool) => {
    const tool = <T extends z.ZodRawShape = z.ZodRawShape>({
      capability,
      name,
      description,
      schema,
      handler,
    }: ToolProps<T>) => {
      if (capabilities && !capabilities.includes(capability)) return;
      server.tool(
        name,
        description,
        schema?.shape ?? {},
        async (props) => (await handler(props as T)).getResult()
      );
    };

    registerTool({ tool, context, result });
  });
}
