# Bricks

一個可組合的 MCP 編排器，整合了 Server 和 Client 功能，同時也是一個可獨立運行的模組化工作流程平台。

## 快速開始

### 需求

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

## 套件

### @bricks/core

Bricks 工作流程系統的核心介面與類型。

詳細文件請參閱 [packages/core/README.md](./packages/core/README.md)

### @bricks/flow

基於 YAML 工作流程定義的流程執行引擎。

詳細文件請參閱 [packages/flow/README.md](./packages/flow/README.md)

### @bricks/nodes

Bricks 工作流程系統的節點執行器，包含內建節點：`set`、`code`、`if` 和 `mcpTool`。

詳細文件請參閱 [packages/nodes/README.md](./packages/nodes/README.md)

### @bricks/mcp

整合 Server 和 Client 功能的 MCP Server，提供工具、資源和工作流程編排功能。

詳細文件請參閱 [packages/mcp/README.md](./packages/mcp/README.md)

## MVP 目標

目前已完成：

- ✅ 工具 (Tools) - `discover` (搜尋工具和工作流程)
- ✅ 資源 (Resources) - `bricks://info`
- ✅ 提示 (Prompts) - `greeting-prompt`
- ✅ 標準 MCP 協定連線支援
- ✅ 工作流程編排功能
- ✅ YAML 工作流程定義
- ✅ 擴展 `discover` 以包含工作流程

下一步：

- [ ] 支援組合多個 MCP Servers

