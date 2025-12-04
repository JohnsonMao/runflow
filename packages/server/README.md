# MCP Bricks Server

一個可以組合多個 MCP 的 MCP Server，也可以獨立運行。

## 安裝

```bash
pnpm install
```

## 建置

```bash
pnpm build
```

## 執行

```bash
pnpm start
```

## 開發模式

```bash
pnpm dev
```

## 連接方式

### 在 Cursor 中連接

在 Cursor 的設定檔（例如 `~/.cursor/mcp.json`）中加入：

```json
{
  "mcpServers": {
    "mcp-bricks": {
      "command": "node",
      "args": ["/path/to/mcp-practice/packages/server/dist/index.js"]
    }
  }
}
```

### 在 Claude Desktop 中連接

在 Claude Desktop 的設定檔（例如 `~/Library/Application Support/Claude/claude_desktop_config.json`）中加入：

```json
{
  "mcpServers": {
    "mcp-bricks": {
      "command": "node",
      "args": ["/path/to/mcp-practice/packages/server/dist/index.js"]
    }
  }
}
```

## 可用工具

### greet
向使用者打招呼

參數：
- `name` (string, 必填): 使用者的名稱

### echo
回傳輸入的文字

參數：
- `message` (string, 必填): 要回傳的訊息

## 可用資源

### mcp-bricks://info
MCP Bricks Server 的基本資訊

