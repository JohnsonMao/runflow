import { chromium, Page } from "playwright";
import fs from "fs";
import os from "os";
import path from "path";

function getCacheDirectory(): string {
  switch (process.platform) {
    case "linux":
      return process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
    case "darwin":
      return path.join(os.homedir(), "Library", "Caches");
    case "win32":
      return (
        process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")
      );
    default:
      throw new Error("Unsupported platform: " + process.platform);
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

async function createUserDataDir() {
  const cacheDirectory = getCacheDirectory();
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
