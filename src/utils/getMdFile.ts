import fs from "fs";
import path from "path";
import { joinLines } from "./joinLines";

type MDFileNameType = `${string}.md` | `${string}.mdx` | `${string}.markdown`;

export function getMdFile(fileName: MDFileNameType) {
  try {
    const absolutePath = path.resolve(
      __dirname,
      "..",
      "..",
      "dist",
      "md",
      fileName
    );
    return fs.promises.readFile(absolutePath, "utf-8");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw new Error(
      joinLines(
        `No such file or directory: ${fileName}`,
        `error: ${errorMessage}`
      )
    );
  }
}
