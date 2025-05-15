import { z } from "zod";
import type { RegisterToolType } from "../type";

import { execCommand } from "../utils/execCommand";
import { getMdFile } from "../utils/getMdFile";
import { joinLines } from "../utils/joinLines";

const getGitDiffResult = async (workingDirectory: string) => {
  const gitStagedDiff = await execCommand(
    "git diff --staged",
    workingDirectory
  );

  const useStaged = !!gitStagedDiff;
  const diffContent = useStaged
    ? gitStagedDiff
    : await execCommand("git diff", workingDirectory);
  const diffCommand = useStaged ? "git diff --staged" : "git diff";

  return joinLines(
    `Here is the result of \`${diffCommand}\`:`,
    "```diff",
    diffContent,
    "```",
    "Generate commit message:"
  );
};

export const registerGetCommitMessage: RegisterToolType = ({
  tool,
  result,
}) => {
  const schema = z.object({
    workingDirectory: z
      .string()
      .describe(
        joinLines(
          "The absolute path of the project root directory,",
          "for example:",
          "- (Mac/Linux) /Users/username/projects/my-project",
          "- (Windows) C:\\Users\\username\\projects\\my-project"
        )
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
        const gitDiffResult = await getGitDiffResult(workingDirectory);

        return result.addText(mdFileContent).addText(gitDiffResult);
      } catch (error) {
        return result.addError(error);
      }
    },
  });
};
