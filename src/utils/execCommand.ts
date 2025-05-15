import path from "path";
import { spawn } from "child_process";

type QuoteCharType = `'` | `"`;

/**
 * Parse command string into executable and arguments, handling spaces in arguments
 * @param command Command string to parse
 * @example
 * parseCommand('git diff --cached') // ["git", ["diff", "--cached"]]
 * parseCommand('git commit -m "fix bug"') // ["git", ["commit", "-m", "fix bug"]]
 * parseCommand("git commit -m 'fix bug'") // ["git", ["commit", "-m", "fix bug"]]
 */
function parseCommand(command: string): [string, string[]] {
  const result: string[] = [];
  const isQuoteChar = (char: string) => char === '"' || char === "'";
  let quoteChar: QuoteCharType | null = null;
  let inQuotes = false;
  let current = "";

  for (const char of command) {
    if (isQuoteChar(char) && (!quoteChar || char === quoteChar)) {
      quoteChar = inQuotes ? null : char;
      inQuotes = !inQuotes;
    } else if (char !== " " || inQuotes) {
      current += char;
    } else if (current) {
      result.push(current);
      current = "";
    }
  }

  if (current) {
    result.push(current);
  }

  return [result[0], result.slice(1)];
}

/**
 * Execute a command and return the data from stdout and stderr
 * @param command Command string to execute
 * @param cwd Working directory for the command
 */
export function execCommand(command: string, cwd: string) {
  return new Promise<string>((resolve, reject) => {
    const normalizedCwd = path.normalize(cwd);
    const [executable, args] = parseCommand(command);

    const process = spawn(executable, args, { cwd: normalizedCwd });
    let output = "";
    let errorOutput = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0 && errorOutput.length === 0) {
        resolve(output);
      } else {
        reject(
          new Error(
            `${command} process exited with code ${code} in ${normalizedCwd}: ${errorOutput}`
          )
        );
      }
    });

    process.on("error", (err) => {
      reject(
        new Error(
          `Failed to start ${command} process in ${normalizedCwd}: ${err.message}`
        )
      );
    });
  });
}
