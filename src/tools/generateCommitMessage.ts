import { z } from "zod";

import { RegisterToolType } from "./type";
import { getMdFile } from "../utils/getMdFile";
import {
  createErrorResponse,
  createSuccessResponse,
  createTextContent,
} from "../utils/responseUtils";
import { execCommand } from "../utils/execCommand";

export const registerGetCommitMessage: RegisterToolType = (tool) => {
  const schema = {
    workingDirectory: z
      .string()
      .describe(
        "The absolute path of the project root directory, for example: /Users/yourname/projects/yourproject"
      ),
  };

  tool(
    "generate_commit_message",
    "Generate standardized commit message",
    schema,
    async (args) => {
      try {
        const { workingDirectory } = z.object(schema).parse(args);
        const mdFileContent = await getMdFile("git-commit-message.md");
        const gitDiff = await execCommand(
          "git",
          ["diff", "--staged"],
          workingDirectory
        );

        let result = "";

        result += "Here is the result of `git diff --staged`:";
        result += "```diff";
        result += gitDiff;
        result += "```";
        result += "Generate commit message:";

        return createSuccessResponse(
          createTextContent(mdFileContent),
          createTextContent(result)
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
};
