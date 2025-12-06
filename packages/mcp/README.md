# Bricks MCP

一個可以組合多個 MCP 的 MCP Server，整合了 Server 和 Client 功能，也可以獨立運行。

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

#### 方式 1：使用 npx（推薦，適合開發）

在 Cursor 的設定檔（例如 `~/.cursor/mcp.json`）中加入：

```json
{
  "mcpServers": {
    "bricks": {
      "command": "npx",
      "args": ["-y", "@bricks/mcp"]
    }
  }
}
```

**優點：**
- ✅ 不需要全域安裝
- ✅ 自動使用最新版本
- ✅ 適合開發和測試

#### 方式 2：全域安裝後使用（適合生產）

```bash
# 安裝
pnpm add -g @bricks/mcp
# 或
npm install -g @bricks/mcp
```

```json
{
  "mcpServers": {
    "bricks": {
      "command": "bricks"
    }
  }
}
```

**優點：**
- ✅ 執行速度快
- ✅ 版本穩定
- ✅ 適合生產環境

#### 方式 3：本地開發（直接指定路徑）

```json
{
  "mcpServers": {
    "bricks": {
      "command": "node",
      "args": ["/path/to/bricks/packages/mcp/dist/index.js"]
    }
  }
}
```

### 在 Claude Desktop 中連接

在 Claude Desktop 的設定檔（例如 `~/Library/Application Support/Claude/claude_desktop_config.json`）中加入：

**使用 npx：**

```json
{
  "mcpServers": {
    "bricks": {
      "command": "npx",
      "args": ["-y", "@bricks/mcp"]
    }
  }
}
```

**或全域安裝後：**

```json
{
  "mcpServers": {
    "bricks": {
      "command": "bricks"
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

### bricks://info
Bricks MCP Server 的基本資訊

