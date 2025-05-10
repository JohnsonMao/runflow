import { spawn } from "child_process";

export function execCommand(command: string, args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    const commandString = `${command} ${args.join(" ")}`.trim();
    const gitDiffProcess = spawn(command, args, { cwd });
    let output = "";
    let errorOutput = "";

    gitDiffProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    gitDiffProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    gitDiffProcess.on("close", (code) => {
      if (code === 0 && errorOutput.length === 0) {
        resolve(output);
      } else {
        reject(
          new Error(
            `${commandString} process exited with code ${code} in ${cwd}: ${errorOutput}`
          )
        );
      }
    });

    gitDiffProcess.on("error", (err) => {
      reject(
        new Error(
          `Failed to start ${commandString} process in ${cwd}: ${err.message}`
        )
      );
    });
  });
}
