#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

/**
 * MCP Bricks Server
 * 一個可以組合多個 MCP 的 MCP Server
 */
const server = new McpServer(
  {
    name: "mcp-bricks",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
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
          text: `你好，${name}！歡迎使用 MCP Bricks Server。`,
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

// 註冊資源
server.registerResource(
  "info",
  "mcp-bricks://info",
  {
    title: "MCP Bricks 資訊",
    description: "MCP Bricks Server 的基本資訊",
    mimeType: "text/plain",
  },
  async (): Promise<ReadResourceResult> => {
    return {
      contents: [
        {
          uri: "mcp-bricks://info",
          mimeType: "text/plain",
          text: `MCP Bricks Server v0.1.0

這是一個可以組合多個 MCP 的 MCP Server。

功能：
- 工具調用 (Tools)
- 資源提供 (Resources)
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
  console.error("MCP Bricks Server 已啟動");
}

main().catch((error) => {
  console.error("Server 啟動失敗:", error);
  process.exit(1);
});
