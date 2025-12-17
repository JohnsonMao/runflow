import type { IExpressionContext, IExpressionEvaluator } from "@bricks/core";
import { isPureExpression, parseExpressionString } from "./parser";

export class ExpressionEvaluationError extends Error {
  constructor(
    message: string,
    public readonly expression: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ExpressionEvaluationError";
  }
}

export interface EvaluationOptions {
  allowUnsafe?: boolean;
}

export class ExpressionEvaluator implements IExpressionEvaluator {
  private safeGlobals: Record<string, unknown>;

  constructor(options: EvaluationOptions = {}) {
    this.safeGlobals = this.createSafeGlobals(options);
  }

  evaluate(expression: string, context: IExpressionContext): unknown {
    try {
      const code = this.buildEvaluationCode(expression, context);
      const result = this.executeCode(code, context);
      return result;
    } catch (error) {
      throw new ExpressionEvaluationError(
        `Failed to evaluate expression: ${error instanceof Error ? error.message : String(error)}`,
        expression,
        error
      );
    }
  }

  evaluateString(input: string, context: IExpressionContext): string {
    const tokens = parseExpressionString(input);

    if (tokens.length === 1 && tokens[0]?.type === "literal") {
      return tokens[0].value;
    }

    let result = "";
    for (const token of tokens) {
      if (token.type === "literal") {
        result += token.value;
      } else {
        const evaluated = this.evaluate(token.value, context);
        result += this.stringify(evaluated);
      }
    }

    return result;
  }

  evaluateValue(input: unknown, context: IExpressionContext): unknown {
    if (typeof input === "string") {
      if (isPureExpression(input)) {
        const tokens = parseExpressionString(input);
        if (tokens[0]?.type === "expression") {
          return this.evaluate(tokens[0].value, context);
        }
      }
      return this.evaluateString(input, context);
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.evaluateValue(item, context));
    }

    if (input !== null && typeof input === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        const evaluatedKey = typeof key === "string" ? this.evaluateString(key, context) : key;
        result[String(evaluatedKey)] = this.evaluateValue(value, context);
      }
      return result;
    }

    return input;
  }

  private buildEvaluationCode(expression: string, context: IExpressionContext): string {
    const helpers = this.buildHelpers(context);
    return `
      ${helpers}
      return (${expression});
    `;
  }

  private buildHelpers(context: IExpressionContext): string {
    const inputHelper = `const $input = {
      first: () => ({ json: ${JSON.stringify(context.input[0] ?? {})} }),
      all: () => ${JSON.stringify(context.input)}.map(item => ({ json: item }))
    };`;

    const jsonHelper = `const $json = ${JSON.stringify(context.json)};`;

    const envHelper = `const $env = ${JSON.stringify(context.env)};`;

    const nodeAccessHelper = `
      const $nodeResultsData = ${JSON.stringify(Object.fromEntries(context.nodeResults))};
      const $ = (nodeName) => {
        const result = $nodeResultsData[nodeName] || {};
        return {
          item: { json: result },
          first: () => ({ json: result }),
          all: () => [{ json: result }]
        };
      };
    `;

    return `
      ${inputHelper}
      ${jsonHelper}
      ${envHelper}
      ${nodeAccessHelper}
    `;
  }

  private executeCode(code: string, _context: IExpressionContext): unknown {
    const func = new Function(...Object.keys(this.safeGlobals), code);
    return func(...Object.values(this.safeGlobals));
  }

  private createSafeGlobals(options: EvaluationOptions): Record<string, unknown> {
    const globals: Record<string, unknown> = {
      JSON: {
        stringify: JSON.stringify,
        parse: JSON.parse,
      },
      Math: Math,
      Date: Date,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
    };

    if (options.allowUnsafe) {
      globals.console = console;
      globals.process = process;
    }

    return globals;
  }

  private stringify(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

export function createExpressionEvaluator(options?: EvaluationOptions): ExpressionEvaluator {
  return new ExpressionEvaluator(options);
}
