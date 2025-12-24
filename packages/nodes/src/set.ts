import type { INodeExecutionContext, INodeExecutionResult } from "@bricks/core";
import { BaseNodeExecutor } from "@bricks/core";

export class SetNodeExecutor extends BaseNodeExecutor {
  readonly type = "set";

  async execute(ctx: INodeExecutionContext): Promise<INodeExecutionResult> {
    const assignments = this.getParameter<{
      assignments: Array<{ name: string; type: string; value: unknown }>;
    }>("assignments", ctx);

    if (!assignments || !assignments.assignments) {
      return this.createResult({});
    }

    const result: Record<string, unknown> = {};

    for (const assignment of assignments.assignments) {
      const value = this.evaluateValue(assignment.value, ctx);
      result[assignment.name] = value;
    }

    return this.createResult(result);
  }
}
