import { CallToolResult } from "@modelcontextprotocol/sdk/types";

type CallToolResultContent = CallToolResult["content"][number];

export function createTextContent(text: string): CallToolResultContent {
  return { type: "text", text };
}

export function createResult(
  content: CallToolResultContent[],
  isError: boolean = false
): CallToolResult {
  return { content, isError };
}

export function createSuccessResult(
  ...content: CallToolResultContent[]
): CallToolResult {
  return createResult(content);
}

export function createErrorResult(error: unknown): CallToolResult {
  const text = error instanceof Error ? error.message : String(error);

  return createResult([createTextContent(text)], true);
}

export function createTextResult(text: string): CallToolResult {
  return createSuccessResult(createTextContent(text));
}

export function formatPrettyJsonString(data: any): string {
  let stringified = "";

  stringified += "```json\n";
  stringified += JSON.stringify(data, null, 2);
  stringified += "\n```";

  return stringified;
}
