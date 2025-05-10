import z from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { CallToolResult } from "@modelcontextprotocol/sdk/types";

export interface IContext {
  setItem<T>(key: string, value: T): void;
  getItem<T>(key: string): T;
  deleteItem(key: string): void;
  clear(): void;
}

export interface IContextOptions {
  cacheDirectory?: string;
}

export type CallToolResultContent = CallToolResult["content"][number];

export interface IResult {
  content: CallToolResultContent[];
  isError: boolean;
  setIsError(isError: boolean): IResult;
  addText(text: string): IResult;
  addImage(data: string, mimeType: string): IResult;
  addError(error: unknown): IResult;
  getResult(): CallToolResult;
  reset(): IResult;
}

export type ToolProps<T extends z.ZodRawShape = z.ZodRawShape> = {
  name: string;
  description: string;
  schema?: z.ZodObject<T>;
  handler: (
    args: z.infer<z.ZodObject<T>>
  ) => IResult | Promise<IResult>;
};

type RegisterToolPropsType = {
  tool: <T extends z.ZodRawShape = z.ZodRawShape>(props: ToolProps<T>) => void;
  context: IContext;
  result: IResult,
};

export type RegisterToolType = (props: RegisterToolPropsType) => void;

export type RegisterToolsPropsType = {
  server: McpServer;
  context: IContext;
  result: IResult;
};
