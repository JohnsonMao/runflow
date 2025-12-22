import type { INodeExecutionContext, INodeExecutionResult } from "@bricks/core";
import { BaseNodeExecutor } from "@bricks/core";

export class CodeNodeExecutor extends BaseNodeExecutor {
  readonly type = "code";

  async execute(
    ctx: INodeExecutionContext
  ): Promise<INodeExecutionResult | INodeExecutionResult[]> {
    const language = this.getParameter<string>("language", ctx, "javascript");
    const code = this.getParameter<string>("code", ctx);

    if (!code) {
      throw new Error(`Code node requires "code" parameter`);
    }

    if (language !== "javascript") {
      throw new Error(`Unsupported language: ${language}. Only JavaScript is supported currently.`);
    }

    try {
      const result = this.executeJavaScript(code, ctx);
      return result;
    } catch (error) {
      return {
        json: {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        },
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private executeJavaScript(
    code: string,
    ctx: INodeExecutionContext
  ): INodeExecutionResult | INodeExecutionResult[] {
    const items = ctx.input.map((item) => ({ json: item.json }));

    const helpers = `
      const $input = {
        first: () => items[0] || { json: {} },
        all: () => items
      };
      
      const items = ${JSON.stringify(items)};
    `;

    const fullCode = `${helpers}\n${code}`;

    const func = new Function(fullCode);
    const result = func();

    if (Array.isArray(result)) {
      return result.map((item) => {
        if (item && typeof item === "object" && "json" in item) {
          return { json: item.json as Record<string, unknown> };
        }
        return { json: { result: item } };
      });
    }

    if (result && typeof result === "object" && "json" in result) {
      return { json: result.json as Record<string, unknown> };
    }

    return { json: { result } };
  }
}
