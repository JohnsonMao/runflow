import type { IExecutionContext } from "./context";
import type { IExpressionEvaluator } from "./evaluator";

export interface INode {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  position?: [number, number];
  credentials?: {
    credentialType: {
      id: string;
      name: string;
    };
  };
  executeOnce?: boolean;
  retryOnFail?: boolean;
  notes?: string;
  notesInFlow?: boolean;
}

export interface NodeRouting {
  outputIndex: number;
  inputData?: Array<Record<string, unknown>>;
}

export interface INodeExecutionResult {
  json: Record<string, unknown>;
  error?: Error;
  routing: NodeRouting;
}

export interface INodeExecutionContext {
  node: INode;
  context: IExecutionContext;
  evaluator: IExpressionEvaluator;
  input: Array<Record<string, unknown>>;
}

export interface INodeExecutor {
  readonly type: string;
  execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult | INodeExecutionResult[]>;
}
