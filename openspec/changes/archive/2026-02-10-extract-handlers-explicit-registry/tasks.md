# Tasks: Extract Handlers & Explicit Registry

**Note (2026-02):** After this change was completed, the built-in **command** and **js** handlers were removed from `@runflow/handlers`. The default built-in set is now: http, condition, sleep, set, loop, flow. Config `allowedCommands` and core export `DEFAULT_ALLOWED_COMMANDS` were removed. See main specs `command-step`, `config-allowed-commands`, `js-step-type`, `js-step-file` for status.

實作順序建議：先 core 對外 API 與 executor，再新增 handlers package 並搬移，最後更新 CLI / convention-openapi / 文件。

---

## Phase 1: Core 準備（export 與 registry 移除預設）

- [x] **1.1** 在 `@runflow/core` 的 `index.ts` 中 export `DEFAULT_ALLOWED_COMMANDS`（來自 constants）與 `isPlainObject`（來自 utils），供 handlers package 使用。
- [x] **1.2** 修改 `packages/core/src/registry.ts`：刪除所有 handler 的 import 以及 `createDefaultRegistry()` 函式；僅保留並 export `registerStepHandler(registry, type, handler)`。
- [x] **1.3** 修改 `packages/core/src/index.ts`：移除對 `createDefaultRegistry` 的 export；保留 `registerStepHandler` 與其餘 export。
- [x] **1.4** 修改 `packages/core/src/executor.ts`：移除對 `createDefaultRegistry` 的 import 與使用。改為從 `options.registry` 取得 registry；若 flow 有 steps 且 `options.registry == null`，則 throw 明確錯誤（例如 "registry is required when flow has steps"）。更新 `RunOptions` 型別：`registry` 在「flow 有 step 時」視為必填（型別或執行期檢查二擇一，建議型別必填以利呼叫端）。
- [x] **1.5** 跑 core 單測：此時會因 executor 等測試仍使用 `createDefaultRegistry` 而失敗，屬預期；Phase 2 搬移後改由測試端建 registry。

---

## Phase 2: 新增 @runflow/handlers package 並搬移

- [x] **2.1** 在 `packages/` 下新增 `handlers` 目錄，建立 `package.json`（name: `@runflow/handlers`，dependency: `@runflow/core`）、`tsconfig.json`、`tsup.config.ts`、`vitest.config.ts`，與 `packages/core` 風格一致；加入 pnpm workspace。
- [x] **2.2** 將 `packages/core/src/handlers/` 下所有 `*.ts`（含 `command.ts`, `command.test.ts`, … 至 `flow.ts`, `flow.test.ts`）複製到 `packages/handlers/src/`。
- [x] **2.3** 在 handlers 的每個檔案中，將原本從 `../types`、`../utils`、`../constants` 等的 import 改為從 `@runflow/core` 引入（types、stepResult、registerStepHandler、DEFAULT_ALLOWED_COMMANDS、isPlainObject 等，依 design 的 core export）。
- [x] **2.4** 在 `packages/handlers/src` 新增 `index.ts`：export 所有 handler 類別（或單例），並 export `createBuiltinRegistry(): StepRegistry`（內部建立空物件並用 registerStepHandler 註冊所有內建 handler）。可選：另 export `registerBuiltinHandlers(registry)`。
- [x] **2.5** 從 `packages/core/src/handlers/` 刪除所有已搬移的檔案；從 core 的 `registry.ts`、`executor.ts`、`index.ts` 確認已無對 handlers 目錄或 createDefaultRegistry 的依賴。
- [x] **2.6** 執行 `pnpm --filter @runflow/handlers install` 與 `pnpm --filter @runflow/handlers test`，確認 handlers 單測全過。
- [x] **2.7** 修改 core 的 executor 測試（及依賴 registry 的測試）：改為使用 stub registry 或從 `@runflow/handlers` 的 `createBuiltinRegistry()` 取得 registry 後傳入 `run(flow, { registry })`。若 core 不願依賴 handlers，則僅用 stub。執行 `pnpm --filter @runflow/core test` 通過。

---

## Phase 3: CLI 與 convention-openapi

- [x] **3.1** 在 `apps/cli/package.json` 增加對 `@runflow/handlers` 的 dependency。CLI 建 registry 處改為：先 `createBuiltinRegistry()` from `@runflow/handlers`，再依既有邏輯 merge config 的 `handlers` 與 `--registry`。
- [x] **3.2** 執行 `pnpm --filter @runflow/cli test`（及相關 e2e）通過。
- [x] **3.3** 若 `packages/convention-openapi` 有呼叫 `run()` 或使用 registry（例如 integration test）：改為從 `@runflow/handlers` 取得 `createBuiltinRegistry()` 並傳入 `run(flow, { registry })`；必要時在 convention-openapi 的 package.json 加上對 `@runflow/handlers` 的 dependency。執行該 package 的 test 通過。

---

## Phase 4: 文件與範例

- [x] **4.1** 更新 root 或 core 的 README：說明 run 時必須傳入 `registry`；內建 step 由 `@runflow/handlers` 提供，並示範 `createBuiltinRegistry()` 或 `registerBuiltinHandlers(registry)` 的用法。
- [x] **4.2** 更新 `examples/custom-handler`（若適用）：改為先以 `createBuiltinRegistry()` 建立 registry，再註冊自訂 handler，然後 run；README 說明此流程。
- [x] **4.3** 執行 `pnpm run check`（或等同的 typecheck + lint + test）確認全 repo 通過。

---

## 完成條件

- Core 不再包含 handler 實作與 createDefaultRegistry；run 必填 registry（有 step 時）。
- @runflow/handlers 存在且通過單測；CLI 與 convention-openapi 使用 handlers 建 registry 並通過測試。
- 文件與範例反映「由使用方主動註冊、內建來自 @runflow/handlers」的用法。
