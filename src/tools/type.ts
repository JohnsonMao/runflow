import z from "zod";
import type Context from "../context";
import type Result from "../result";

export type ToolProps<T extends z.ZodRawShape = z.ZodRawShape> = {
  name: string;
  description: string;
  schema?: z.ZodObject<T>;
  handler: (
    args: z.infer<z.ZodObject<T>>
  ) => Result | Promise<Result>;
};

type RegisterToolPropsType = {
  tool: <T extends z.ZodRawShape = z.ZodRawShape>(props: ToolProps<T>) => void;
  context: Context;
  result: Result,
};

export type RegisterToolType = (props: RegisterToolPropsType) => void;
