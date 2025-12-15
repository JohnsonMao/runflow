import type { IExpressionContext } from "./context";

export interface IExpressionEvaluator {
  evaluate(expression: string, context: IExpressionContext): unknown;
  evaluateString(input: string, context: IExpressionContext): string;
  evaluateValue(input: unknown, context: IExpressionContext): unknown;
}
