import { CallToolResult } from "@modelcontextprotocol/sdk/types";

type CallToolResultContent = CallToolResult["content"][number];

export function createTextContent(text: string): CallToolResultContent {
  return { type: "text", text };
}

export function createTextResponse(text: string): CallToolResult {
  return { content: [createTextContent(text)] };
}

export function createSuccessResponse(
  ...content: CallToolResultContent[]
): CallToolResult {
  return { content };
}

export function createErrorResponse(error: unknown): CallToolResult {
  const text = error instanceof Error ? error.message : String(error);

  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

export function formatPrettyJsonString(data: any): string {
  let stringified = "```json\n";

  stringified += JSON.stringify(data, null, 2);
  stringified += "\n```";

  return stringified;
}
