import type { INodeExecutionContext, INodeExecutionResult } from "@bricks/core";
import { BaseNodeExecutor } from "@bricks/core";

export interface McpToolExecutorOptions {
  callTool: (server: string, tool: string, args: Record<string, unknown>) => Promise<unknown>;
}

export class McpToolNodeExecutor extends BaseNodeExecutor {
  readonly type = "mcpTool";

  constructor(private options: McpToolExecutorOptions) {
    super();
  }

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const server = this.getParameter<string>("server", ctx);
    const tool = this.getParameter<string>("tool", ctx);
    const arguments_ = this.getParameter<Record<string, unknown>>("arguments", ctx, {});

    if (!server || !tool) {
      throw new Error(`MCP Tool node requires "server" and "tool" parameters`);
    }

    try {
      const result = await this.options.callTool(server, tool, arguments_);

      if (result && typeof result === "object" && "content" in result) {
        const content = (
          result as {
            content: Array<{ type: string; text?: string }>;
          }
        ).content;
        const text = content
          .filter((item) => item.type === "text" && item.text)
          .map((item) => item.text)
          .join("\n");

        return {
          json: {
            result,
            text,
            success: true,
          },
        };
      }

      return {
        json: {
          result,
          success: true,
        },
      };
    } catch (error) {
      return {
        json: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}
