# Proposal: Extract Handlers Package & Explicit Registry

## Why

- **架構邊界**：引擎（parser、executor、loader、types）與「內建 step 實作」分離，core 只負責契約與分派，擴充時改動邊界清晰。
- **無循環依賴**：handlers 僅依賴 core；core 不依賴 handlers，避免 core ↔ handlers 循環。
- **由使用方主動註冊**：誰用 core 誰建 registry、註冊所需 handler，不隱含預設；內建 step 改為可選依賴 `@runflow/handlers`，利於精簡依賴與多種 handler 組合。

## What Changes

- **Handlers 獨立成 package**：將 `packages/core` 內 `src/handlers/` 搬至新 package（如 `@runflow/handlers`），僅依賴 `@runflow/core`（types、stepResult、constants、utils）。core 不再包含任何 handler 實作。
- **取消 createDefaultRegistry**：core 不再提供 `createDefaultRegistry()`。使用 core 的消費者（CLI、convention-openapi、其他）須自行建 registry 並以 `registerStepHandler` 註冊所需 handler；若要用內建 step，則依賴 `@runflow/handlers` 並手動註冊各 handler（或由 handlers package 提供「註冊所有內建」的輔助函式，但不由 core 預設提供）。

## Capabilities

### New Capabilities

- **handlers-package**：新 package 的邊界、exports、與 core 的依賴關係；內建 step 型別（http, condition, sleep, set, loop, flow）的實作與測試搬移；必要時 core 需 export constants/utils 供 handlers 使用。（註：command 與 js 已於 2026-02 自內建移除。）

### Modified Capabilities

- **custom-node-registry**（或對應 spec）：移除「default registry」的提供責任；明確規定 engine 不提供預設 registry，呼叫端必須傳入已註冊的 registry。

## Impact

- **Breaking**：所有目前使用 `createDefaultRegistry()` 的程式（CLI、convention-openapi、tests）須改為從 `@runflow/handlers` 取得內建 handler 並自行建 registry、註冊。
- **依賴**：`@runflow/handlers` 僅依賴 `@runflow/core`；core 不依賴 handlers，無循環依賴。
- **文件與範例**：README、examples、custom-handler 範例需更新為「先建 registry、註冊 handler、再 run」。

## Non-goals

- 不在此 change 做 config 擴充（openapi 設定、examples 收斂）—可另開 change。
