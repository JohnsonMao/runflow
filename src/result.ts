import { CallToolResult } from "@modelcontextprotocol/sdk/types";

export type CallToolResultContent = CallToolResult["content"][number];

interface IResult {
  content: CallToolResultContent[];
  isError: boolean;
  setIsError(isError: boolean): Result;
  addText(text: string): Result;
  addImage(data: string, mimeType: string): Result;
  addError(error: unknown): Result;
  getResult(): CallToolResult;
  reset(): Result;
}

export default class Result implements IResult {
  public content: CallToolResultContent[];
  public isError: boolean;

  constructor(content: CallToolResultContent[], isError: boolean) {
    this.content = content;
    this.isError = isError;
  }

  setIsError(isError: boolean): Result {
    return new Result(this.content, isError);
  }

  addText(text: string): Result {
    return new Result([...this.content, { type: "text", text }], this.isError);
  }

  addImage(data: string, mimeType: string): Result {
    return new Result(
      [...this.content, { type: "image", data, mimeType }],
      this.isError
    );
  }

  addError(error: unknown): Result {
    const text = error instanceof Error ? error.message : String(error);
    return new Result([...this.content, { type: "text", text }], true);
  }

  getResult(): CallToolResult {
    return { content: this.content, isError: this.isError };
  }

  reset(): Result {
    return new Result([], false);
  }
}
