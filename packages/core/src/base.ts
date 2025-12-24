import type {
  INodeExecutionContext,
  INodeExecutionResult,
  INodeExecutor,
  NodeRouting,
} from "./interfaces";

export abstract class BaseNodeExecutor implements INodeExecutor {
  abstract readonly type: string;

  abstract execute(
    ctx: INodeExecutionContext
  ): Promise<INodeExecutionResult | INodeExecutionResult[]>;

  protected evaluateValue(value: unknown, ctx: INodeExecutionContext): unknown {
    const json = (ctx.input[0]?.json ?? {}) as Record<string, unknown>;
    const expressionCtx = ctx.context.toExpressionContext(json);
    return ctx.evaluator.evaluateValue(value, expressionCtx);
  }

  protected evaluateString(value: string, ctx: INodeExecutionContext): string {
    const json = (ctx.input[0]?.json ?? {}) as Record<string, unknown>;
    const expressionCtx = ctx.context.toExpressionContext(json);
    return ctx.evaluator.evaluateString(value, expressionCtx);
  }

  protected getParameter<T>(key: string, ctx: INodeExecutionContext, defaultValue?: T): T {
    const params = ctx.node.parameters as Record<string, unknown>;
    const value = params[key] ?? defaultValue;
    return this.evaluateValue(value, ctx) as T;
  }

  protected createResult(
    json: Record<string, unknown>,
    routing?: Partial<NodeRouting>,
    error?: Error
  ): INodeExecutionResult {
    return {
      json,
      error,
      routing: {
        outputIndex: routing?.outputIndex ?? 0,
        inputData: routing?.inputData,
      },
    };
  }
}

