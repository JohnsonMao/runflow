# Bricks

一個可以組合多個 MCP 的 MCP 編排器，整合了 Server 和 Client 功能，也可以獨立運行的模組化工作流平台。

## 快速開始

### 環境需求

- Node.js >= 20.0.0
- pnpm >= 8.0.0

### 安裝依賴

```bash
pnpm install
```

### 建置專案

```bash
pnpm build
```

### 開發模式

```bash
pnpm dev
```

## Packages

### @bricks/mcp

基本的 MCP Server，整合了 Server 和 Client 功能，提供工具和資源功能。

詳細說明請參考 [packages/mcp/README.md](./packages/mcp/README.md)

## MVP 目標

目前已完成基本的 MCP Server，可以：

- ✅ 提供工具 (Tools) - `greet` 和 `echo`
- ✅ 提供資源 (Resources) - `bricks://info`
- ✅ 支援標準 MCP 協議連接

下一步計劃：
- [ ] 支援組合多個 MCP Server
- [ ] 工作流編排功能
- [ ] YAML 工作流定義
