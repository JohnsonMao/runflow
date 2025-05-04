import { chromium, Page } from "playwright";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * 創建用戶數據目錄
 * @param browserName 瀏覽器名稱
 * @returns 用戶數據目錄路徑
 */
async function createUserDataDir(
  browserName: "chromium" | "firefox" | "webkit"
) {
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
    `mcp-${browserName}-profile`
  );
  await fs.promises.mkdir(result, { recursive: true });
  return result;
}

export async function injectScript(
  targetUrl: string,
  script: Parameters<Page["evaluate"]>[0],
  timeout?: number
): Promise<ReturnType<Page["evaluate"]>> {
  // 使用臨時用戶數據目錄，避免與現有 Chrome 進程衝突
  const userDataDir = await createUserDataDir("chromium");

  try {
    // 使用臨時用戶數據目錄啟動 Chrome 瀏覽器
    const browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      executablePath: getChromePath(),
      args: ["--disable-blink-features=AutomationControlled"],
    });

    // 導航到目標網站
    const page = await browser.newPage();
    await page.goto(targetUrl);

    if (timeout) await page.waitForTimeout(timeout);

    return page.evaluate(script);
  } catch (error) {
    throw error;
  }
}

// 根據作業系統獲取 Chrome 可執行檔路徑
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
