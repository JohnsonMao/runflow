import fs from "fs";
import path from "path";

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
    throw new Error(`No such file or directory: ${fileName}\nerror: ${error}`);
  }
}
