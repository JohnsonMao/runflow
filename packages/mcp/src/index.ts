#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

/**
 * Bricks MCP Server
 * 一個可以組合多個 MCP 的 MCP Server，整合了 Server 和 Client 功能
 */
const server = new McpServer(
  {
    name: "bricks",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// 註冊 greet 工具
server.registerTool(
  "greet",
  {
    title: "打招呼工具",
    description: "向使用者打招呼",
    inputSchema: {
      name: z.string().describe("使用者的名稱"),
    },
  },
  async ({ name }) => {
    return {
      content: [
        {
          type: "text",
          text: `你好，${name}！歡迎使用 Bricks MCP Server。`,
        },
      ],
    };
  }
);

// 註冊 echo 工具
server.registerTool(
  "echo",
  {
    title: "回音工具",
    description: "回傳輸入的文字",
    inputSchema: {
      message: z.string().describe("要回傳的訊息"),
    },
  },
  async ({ message }) => {
    return {
      content: [
        {
          type: "text",
          text: message,
        },
      ],
    };
  }
);

// 註冊生成圖片工具（返回 SVG 圖片的 base64）
server.registerTool(
  "generate-image",
  {
    title: "生成圖片工具",
    description: "根據文字描述生成一個簡單的 SVG 圖片，返回 base64 編碼",
    inputSchema: {
      text: z.string().describe("要顯示在圖片中的文字"),
      width: z.number().optional().default(400).describe("圖片寬度"),
      height: z.number().optional().default(200).describe("圖片高度"),
    },
  },
  async ({ text, width = 400, height = 200 }) => {
    // 生成一個簡單的 SVG 圖片
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#4F46E5"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">${text}</text>
</svg>`;
    
    // 將 SVG 轉換為 base64
    const base64Svg = Buffer.from(svg).toString("base64");
    
    return {
      content: [
        {
          type: "text" as const,
          text: `已生成圖片：${text}`,
        },
        {
          type: "image" as const,
          data: base64Svg,
          mimeType: "image/svg+xml",
        },
      ],
    };
  }
);

// 註冊 Prompt
server.registerPrompt(
  "greeting-prompt",
  {
    title: "問候提示",
    description: "生成一個個人化的問候訊息",
    argsSchema: {
      name: z.string().describe("使用者的名稱"),
      timeOfDay: z.enum(["morning", "afternoon", "evening"]).optional().describe("時段"),
    },
  },
  async ({ name, timeOfDay }) => {
    const timeGreeting = {
      morning: "早上好",
      afternoon: "下午好",
      evening: "晚上好",
    };
    
    const greeting = timeOfDay ? timeGreeting[timeOfDay] : "你好";
    
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `${greeting}，${name}！歡迎使用 Bricks MCP Server。`,
          },
        },
      ],
    };
  }
);

// 註冊資源
server.registerResource(
  "info",
  "bricks://info",
  {
    title: "Bricks MCP 資訊",
    description: "Bricks MCP Server 的基本資訊",
    mimeType: "text/plain",
  },
  async (): Promise<ReadResourceResult> => {
    return {
      contents: [
        {
          uri: "bricks://info",
          mimeType: "text/plain",
          text: `Bricks MCP Server v0.1.0

這是一個可以組合多個 MCP 的 MCP Server，整合了 Server 和 Client 功能。

功能：
- 工具調用 (Tools)
- 資源提供 (Resources)
- MCP Client 功能（連接其他 MCP Servers）
- 模組化設計

歡迎使用！`,
        },
      ],
    };
  }
);

// 啟動 Server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bricks MCP Server 已啟動");
}

main().catch((error) => {
  console.error("Server 啟動失敗:", error);
  process.exit(1);
});
