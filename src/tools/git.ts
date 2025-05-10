import { z } from "zod";
import type { RegisterToolType } from "../type";

import { execCommand } from "../utils/execCommand";
import { getMdFile } from "../utils/getMdFile";

export const registerGetCommitMessage: RegisterToolType = ({
  tool,
  result,
}) => {
  const schema = z.object({
    workingDirectory: z
      .string()
      .describe(
        "The absolute path of the project root directory, for example: /Users/yourname/projects/yourproject"
      ),
  });

  tool({
    capability: "git",
    name: "generate_commit_message",
    description: "Generate standardized commit message",
    schema,
    handler: async ({ workingDirectory }) => {
      try {
        const mdFileContent = await getMdFile("git-commit-message.md");
        const gitDiff = await execCommand(
          "git",
          ["diff", "--staged"],
          workingDirectory
        );

        let gitDiffResult = "";

        gitDiffResult += "Here is the result of `git diff --staged`:";
        gitDiffResult += "```diff";
        gitDiffResult += gitDiff;
        gitDiffResult += "```";
        gitDiffResult += "Generate commit message:";

        return result.addText(mdFileContent).addText(gitDiffResult);
      } catch (error) {
        return result.addError(error);
      }
    },
  });
};
