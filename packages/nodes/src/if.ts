import type { INodeExecutionContext, INodeExecutionResult } from "@bricks/core";
import { BaseNodeExecutor } from "@bricks/core";

export class IfNodeExecutor extends BaseNodeExecutor {
  readonly type = "if";

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const conditions = this.getParameter<{
      combinator: "and" | "or";
      conditions: Array<{
        leftValue: string;
        operator: { type: string; operation: string };
        rightValue: unknown;
      }>;
    }>("conditions", ctx);

    if (!conditions || !conditions.conditions || conditions.conditions.length === 0) {
      return this.createResult({ result: false }, { outputIndex: 1 });
    }

    const results = conditions.conditions.map((condition) => {
      const leftValue = this.evaluateValue(condition.leftValue, ctx);
      const rightValue = this.evaluateValue(condition.rightValue, ctx);
      return this.evaluateCondition(leftValue, condition.operator.operation, rightValue);
    });

    let result: boolean;
    if (conditions.combinator === "and") {
      result = results.every((r) => r === true);
    } else {
      result = results.some((r) => r === true);
    }

    return this.createResult(
      { result },
      {
        outputIndex: result ? 0 : 1,
      }
    );
  }

  private evaluateCondition(left: unknown, operation: string, right: unknown): boolean {
    switch (operation) {
      case "equals":
        return left === right;
      case "notEquals":
        return left !== right;
      case "contains":
        return String(left).includes(String(right));
      case "notContains":
        return !String(left).includes(String(right));
      case "gt":
        return Number(left) > Number(right);
      case "gte":
        return Number(left) >= Number(right);
      case "lt":
        return Number(left) < Number(right);
      case "lte":
        return Number(left) <= Number(right);
      case "exists":
        return left !== null && left !== undefined;
      case "notExists":
        return left === null || left === undefined;
      case "empty":
        if (Array.isArray(left)) {
          return left.length === 0;
        }
        return !left;
      case "notEmpty":
        if (Array.isArray(left)) {
          return left.length > 0;
        }
        return !!left;
      default:
        return false;
    }
  }
}
