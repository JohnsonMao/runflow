export interface ExpressionToken {
  type: "literal" | "expression";
  value: string;
}

const EXPRESSION_PATTERN = /=\{\{([\s\S]*?)\}\}/g;

export function parseExpressionString(input: string): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];
  let lastIndex = 0;

  EXPRESSION_PATTERN.lastIndex = 0;

  let match = EXPRESSION_PATTERN.exec(input);
  while (match !== null) {
    if (match.index > lastIndex) {
      const literal = input.substring(lastIndex, match.index);
      if (literal) {
        tokens.push({ type: "literal", value: literal });
      }
    }

    const expression = match[1]?.trim() ?? "";
    if (expression) {
      tokens.push({ type: "expression", value: expression });
    }

    lastIndex = EXPRESSION_PATTERN.lastIndex;
    match = EXPRESSION_PATTERN.exec(input);
  }

  if (lastIndex < input.length) {
    const literal = input.substring(lastIndex);
    if (literal) {
      tokens.push({ type: "literal", value: literal });
    }
  }

  if (tokens.length === 0) {
    tokens.push({ type: "literal", value: input });
  }

  return tokens;
}

export function hasExpression(input: string): boolean {
  return EXPRESSION_PATTERN.test(input);
}

export function isPureExpression(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed.startsWith("={{") || !trimmed.endsWith("}}")) {
    return false;
  }

  const tokens = parseExpressionString(trimmed);
  return tokens.length === 1 && tokens[0]?.type === "expression";
}
