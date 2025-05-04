import { RegisterToolType } from "./type";
import { getMdFile } from "../utils/getMdFile";
import { createTextResponse } from "../utils/responseUtils";

export const registerGetCommitMessage: RegisterToolType = (tool) => {
  tool("get_commit_message", "取得 git commit message", () =>
    createTextResponse(getMdFile("git-commit-message.md"))
  );
};
