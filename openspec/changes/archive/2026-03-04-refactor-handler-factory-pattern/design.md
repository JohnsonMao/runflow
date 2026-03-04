## Context

目前 `@runflow` 的 step handler 採用 class-based 的 `IStepHandler` 介面，開發者必須依賴 `@runflow/core` 的型別定義，且自訂 handler 的流程不夠直覺（需要 import、implements、處理打包等）。為了提升開發體驗 (DX) 與可維護性，我們需要將其重構為更輕量、無須顯式 import 的 Factory 模式。

## Goals / Non-Goals

**Goals:**
- 實現「零 import」的 handler 開發體驗。
- 提供內建的 Zod schema 驗證與型別推斷。
- 統一內建與自訂 handler 的開發規範。
- 提供鏈式工具庫 (`utils`) 簡化資料與字串處理。
- 支援 CLI 直接載入 `.ts` handler 檔案。

**Non-Goals:**
- 本次重構不涉及 Flow YAML 語法的改動。
- 不提供 GUI 端的 handler 編輯器（未來規劃）。

## Decisions

### 採用 Zero-Import Factory 模式

我們將導出一個 Factory 函數作為 handler 的定義方式，並統一使用 `export default ({ defineHandler }) => defineHandler(...)` 模式。

**Rationale:**
- **Zero-import**: 開發者不需要 `import { ... } from '@runflow/core'` 即可取得所有工具，避免版本衝突與依賴地獄。
- **類型推斷**: `defineHandler` 的泛型設計能自動推斷 handler 的 schema 輸入與輸出類型。

### 採用 Context Report 機制

Handler 的 `run` 函數將獲取一個具備 `report(result)` 方法的 `context`。

**Rationale:**
- **即時回饋**: 支援長時間執行的 handler 在過程中回報多個狀態或日誌（串流模式）。
- **彈性擴充**: 未來可擴展更多回報類型（如進度條、警告）而不影響回傳結構。
- **簡化邏輯**: 引擎統一收集並合併多次 report 的結果，handler 無需自行維護狀態。

### 整合 Zod 進行宣告式驗證

在 `defineHandler` 中直接傳入 `schema` 物件。

**Rationale:**
- **驗證與型別合一**: Zod schema 既能用於執行期驗證，也能透過 `z.infer` 提供編譯期型別提示。
- **自動化錯誤訊息**: 引擎可以統一代碼來處理 Zod 的錯誤格式，產出一致且易讀的報錯。

### 提供鏈式工具庫 (Chainable Utils)

注入 `utils.str()` 與 `utils.data()` 鏈式工具。

**Rationale:**
- **簡化邏輯**: 減少處理 ${} 替換或物件 pick/merge 時的中間變數。
- **排查友好**: 鏈式調用更容易追蹤資料流向，未來可擴展自動追蹤 (Tracing)。

### 使用 jiti/tsx 實現動態載入

CLI 載入 handler 時使用 `jiti` 或 `tsx`。

**Rationale:**
- **存檔即生效**: 開發者修改 `.ts` 後直接執行 CLI 即可看到結果，無需手動 `tsc` 或重啟打包工具。
- **跨平台一致**: 確保在不同作業系統下都有穩定的 ESM/TS 載入體驗。

## Risks / Trade-offs

- **[Risk]** 全局型別提示失效 → **[Mitigation]** 透過 CLI 自動產生 `.runflow/runflow-env.d.ts` 並確保工作區正確偵測。
- **[Risk]** 效能損耗 → **[Mitigation]** `jiti` 具備快取機制，且 handler 邏輯通常不是效能瓶頸（IO 為主）。
- **[Trade-off]** 拋棄了 Class 的狀態化能力 → **[Rationale]** Handler 應盡量保持無狀態 (Stateless) 以利於並行與重試，複雜狀態應由引擎注入。

## Migration Plan

1.  在 `packages/core` 實作新的 `Factory` 介面與 `Loader`。
2.  在 `packages/handlers` 將所有內建 handler (http, loop 等) 重構為 Factory 模式。
3.  更新 `packages/workspace` 的載入邏輯，支援 `.ts` 檔案與 Factory 注入。
4.  更新文件與範例，引導使用者從 `IStepHandler` 遷移。
