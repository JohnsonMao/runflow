import type { IExecutionContext, IExpressionContext } from "@bricks/core";

export interface ExpressionContext extends IExpressionContext {
  json: Record<string, unknown>;
  input: Array<Record<string, unknown>>;
  env: Record<string, string>;
  nodeResults: Map<string, unknown>;
}

export class ExecutionContext implements IExecutionContext {
  private nodeResults: Map<string, unknown> = new Map();
  private inputData: Array<Record<string, unknown>> = [];
  private env: Record<string, string> = {};

  constructor(initialInput?: Array<Record<string, unknown>>) {
    if (initialInput) {
      this.inputData = initialInput;
    }
    this.loadEnv();
  }

  setNodeResult(nodeId: string, result: unknown): void {
    this.nodeResults.set(nodeId, result);
  }

  getNodeResult(nodeId: string): unknown {
    return this.nodeResults.get(nodeId);
  }

  setInput(input: Array<Record<string, unknown>>): void {
    this.inputData = input;
  }

  getInput(): Array<Record<string, unknown>> {
    return this.inputData;
  }

  getFirstInput(): Record<string, unknown> | undefined {
    return this.inputData[0];
  }

  getAllInput(): Array<Record<string, unknown>> {
    return this.inputData;
  }

  setEnv(key: string, value: string): void {
    this.env[key] = value;
  }

  getEnv(key: string): string | undefined {
    return this.env[key];
  }

  getAllEnv(): Record<string, string> {
    return { ...this.env };
  }

  private loadEnv(): void {
    if (typeof process !== "undefined" && process.env) {
      this.env = Object.fromEntries(
        Object.entries(process.env).filter(([, value]) => value !== undefined)
      ) as Record<string, string>;
    }
  }

  toExpressionContext(currentJson: Record<string, unknown>): ExpressionContext {
    return {
      json: currentJson,
      input: this.inputData,
      env: this.env,
      nodeResults: new Map(this.nodeResults),
    };
  }
}
