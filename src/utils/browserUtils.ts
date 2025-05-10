import { chromium, Page } from "playwright";
import fs from "fs";
import os from "os";
import path from "path";

async function createUserDataDir() {
  let cacheDirectory: string;
  if (process.platform === "linux")
    cacheDirectory =
      process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  else if (process.platform === "darwin")
    cacheDirectory = path.join(os.homedir(), "Library", "Caches");
  else if (process.platform === "win32")
    cacheDirectory =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  else throw new Error("Unsupported platform: " + process.platform);
  const result = path.join(
    cacheDirectory,
    "ms-playwright",
    `mcp-chromium-profile`
  );
  await fs.promises.mkdir(result, { recursive: true });
  return result;
}

export async function injectScript(
  targetUrl: string,
  script: Parameters<Page["evaluate"]>[0],
  timeout?: number
): Promise<ReturnType<Page["evaluate"]>> {
  // Use temporary user data directory to avoid conflicts with existing Chrome processes
  const userDataDir = await createUserDataDir();

  try {
    const browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      executablePath: getChromePath(),
      args: ["--disable-blink-features=AutomationControlled"],
    });

    const page = await browser.newPage();
    await page.goto(targetUrl);

    if (timeout) await page.waitForTimeout(timeout);

    return page.evaluate(script);
  } catch (error) {
    throw error;
  }
}

function getChromePath(): string {
  switch (process.platform) {
    case "darwin":
      return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    case "win32":
      return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    default:
      return "/usr/bin/google-chrome";
  }
}
