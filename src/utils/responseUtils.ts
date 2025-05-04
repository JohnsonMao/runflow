import { CallToolResult } from "@modelcontextprotocol/sdk/types";

/**
 * 創建標準文本回應格式
 * @param text 回傳的文本內容
 * @returns 格式化的回應對象
 */
export function createTextResponse(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

/**
 * 創建標準錯誤回應格式
 * @param error 錯誤信息或錯誤對象
 * @returns 格式化的錯誤回應對象
 */
export function createErrorResponse(error: unknown): CallToolResult {
  const text = error instanceof Error ? error.message : String(error);

  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

/**
 * 將對象轉換為格式化的JSON字符串
 * @param data 要格式化的數據
 * @returns 格式化的JSON字符串
 */
export function formatJson(data: any): string {
  return JSON.stringify(data, null, 2);
}
