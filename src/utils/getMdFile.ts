import fs from "fs";
import path from "path";

export function getMdFile(fileName: string) {
  try {
    const absolutePath = path.resolve(__dirname, "../../dist/md", fileName);
    return fs.readFileSync(absolutePath, "utf-8");
  } catch {
    throw new Error(`No such file or directory: ${fileName}`);
  }
}
