## Context

目前的 `@runflow` 正處於從 Class-based `IStepHandler` 轉向 Function-based `HandlerFactory` 的過渡階段。雖然基礎架構已具備，但程式碼中仍存留舊的介面、Adapter 類別，且 Handler 註冊方式過於繁瑣（需要手動指定 key-value），導致 `@runflow/handlers` 難以與 `@runflow/core` 完全解耦。

## Goals / Non-Goals

**Goals:**

- 移除所有 `IStepHandler` 與 `HandlerAdapter` 相關程式碼。
- 在 `defineHandler` 中加入 `type` 宣告。
- 將 `Registry` 修改為接受 `Handler[]` 陣列。
- 達成 `@runflow/handlers` 對 `@runflow/core` 的零依賴。
- 補齊 `HandlerFactory` 的單元測試。

**Non-Goals:**

- 不變更 Flow YAML 的語法結構。
- 不變更現有的步驟執行邏輯（Executor 邏輯保持不變）。

## Decisions

### 移除 IStepHandler 與 HandlerAdapter

**Rationale:**
- 舊有的 Class 模式增加了開發者的認知負擔，且導致打包時必須依賴 core 的型別。移除 Adapter 能減少執行時的轉譯開銷，讓架構更純粹。
- **Alternatives:** 繼續保留 Adapter 以支援舊版 handler。但目前專案仍在初期，應趁早完成 BREAKING CHANGE 以降低長期維護成本。

### Factory 內置類型宣告

**Rationale:**
- 透過 `defineHandler({ type: 'http', ... })` 讓 handler 自帶身份標識。這樣在註冊時就不需要重複寫 `registry['http'] = httpHandler`。
- **Alternatives:** 繼續在外部由 Registry 決定類型名稱。缺點是若多個地方引用同一 handler，容易造成類型名稱不一致。

### 採用陣列式註冊機制

**Rationale:**
- 改為 `buildRegistry([handlerA, handlerB])`。Registry 會遍歷陣列並根據 handler 自帶的 `type` 自動建立 Map。這大幅簡化了自訂 handler 的擴充流程。
- **Alternatives:** 使用 `Object.values()` 轉換物件。但直接接受陣列更符合直覺且易於組合。

### 徹底解耦 packages/handlers 與 packages/core

**Rationale:**
- `handlers` 套件僅需導出 Factory 函數，這些函數在執行時會由引擎注入所需工具（zod, utils）。因此 `handlers` 不需要將 `core` 列為 `dependency` 或 `peerDependency`。
- **Alternatives:** 使用 `peerDependency`。缺點是當 core 版本升級時，所有 handler 套件都需要同步更新版本號。

### 為 HandlerFactory 增加單元測試

**Rationale:**
- 目前 `factory.ts` 的測試覆蓋不足，無法確保各種邊界情況（如 schema 驗證失敗、錯誤回報機制等）的正確性。

## Risks / Trade-offs

- **[Risk]** Breaking Change 導致現有外部 handler 無法運作 → **[Mitigation]** 更新範例檔並提供遷移文件。
- **[Trade-off]** 失去了 Class 提供的狀態繼承能力 → **[Rationale]** Handler 應保持無狀態以利並行執行與重試。
