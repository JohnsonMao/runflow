export interface IExpressionContext {
  json: Record<string, unknown>;
  input: Array<Record<string, unknown>>;
  env: Record<string, string>;
  nodeResults: Map<string, unknown>;
}

export interface IExecutionContext {
  setNodeResult(nodeId: string, result: unknown): void;
  getNodeResult(nodeId: string): unknown;
  setInput(input: Array<Record<string, unknown>>): void;
  getInput(): Array<Record<string, unknown>>;
  getFirstInput(): Record<string, unknown> | undefined;
  getAllInput(): Array<Record<string, unknown>>;
  setEnv(key: string, value: string): void;
  getEnv(key: string): string | undefined;
  getAllEnv(): Record<string, string>;
  toExpressionContext(currentJson: Record<string, unknown>): IExpressionContext;
}
