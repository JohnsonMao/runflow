import { CallToolResultContent, IResult } from "./type";

export default class Result implements IResult {
  public content: CallToolResultContent[];
  public isError: boolean;

  constructor(content: CallToolResultContent[], isError: boolean) {
    this.content = content;
    this.isError = isError;
  }

  setIsError(isError: boolean) {
    return new Result(this.content, isError);
  }

  addText(text: string) {
    return new Result([...this.content, { type: "text", text }], this.isError);
  }

  addImage(data: string, mimeType: string) {
    return new Result(
      [...this.content, { type: "image", data, mimeType }],
      this.isError
    );
  }

  addError(error: unknown) {
    const text = error instanceof Error ? error.message : String(error);
    return new Result([...this.content, { type: "text", text }], true);
  }

  getResult() {
    return { content: this.content, isError: this.isError };
  }

  reset() {
    return new Result([], false);
  }
}
