# Proposal: 自定義節點（Custom Node Registry）

## Why

目前 Runflow 僅支援內建三種 step 類型（command、js、http），擴充新類型必須改 core 程式碼。使用者無法在不 fork 專案的前提下加入自訂邏輯。引入「統一節點介面」後，**內建與自訂節點都透過同一套介面與註冊機制實作**，core 只負責解析、分派、傳遞 context，所有 step 類型（含 command、js、http）皆為實作該介面的 handler，有利介面定義與未來擴充，並可接受 **breaking changes** 以簡化設計。

## What Changes

- **統一節點介面（interface-first）**：明確定義單一「step handler」契約（輸入：step 內容 + 執行 context；輸出：與 `StepResult` 一致的結構），並對輸入/輸出做型別與欄位約束，方便未來擴充（例如非同步、取消、重試等）。
- **執行引擎只認 registry**：執行時僅依 `step.type` 查表呼叫對應 handler，**不再**在 executor 內用 if/else 區分 command、js、http；command / js / http 改為「內建 handler」預先註冊在預設 registry 中。
- **Parser 與 step 結構**：所有 step（含內建）統一為「id + type + 其餘 key-value 保留給該 type 的 handler 解讀」；parser 僅保證 `id`、`type` 存在且 `type` 為 string，不再對 command/js/http 做專用結構驗證（驗證責任移至各 handler 或可選的 schema）。
- **Breaking changes（不考慮向後相容）**：
  - `run(flow, options)` 的執行語意改為「僅能執行 registry 內有註冊的 type」；未註冊的 type 視為錯誤。
  - 預設提供「內建 registry」（含 command、js、http），呼叫端可覆寫或擴充；若無傳入則使用此預設 registry。
  - 型別上：`FlowStep` 改為通用形狀（如 `{ id: string; type: string; [key: string]: unknown }`），不再用 union 列舉 command/js/http；內建類型的結構以文件或 schema 約束，不強制在型別上區分。
- 文件與型別：匯出 **StepHandler 介面**、**StepContext / StepResult**、**Registry 型別**與註冊 API，方便使用者實作自訂節點與 TypeScript 推論。

## Capabilities

### New Capabilities

- `custom-node-registry`: 統一節點介面與註冊機制。涵蓋：**StepHandler 介面**（輸入、輸出、錯誤處理的定義與限制）、**Registry 型別與註冊 API**、執行時僅依 registry 分派、**StepContext**（params、前序 outputs、flowFilePath 等）與 **StepResult** 契約、YAML 解析規則（所有 step 皆為 id + type + 其餘保留）、預設內建 registry（command、js、http 以 handler 實作）。
- `command-step`: 內建節點型別 `command` 的規格（此前無獨立 spec）。涵蓋：經由 registry 的 command handler 執行、parser 產出通用 step、`run` 由 handler 在執行時要求、模板替換由 executor 在呼叫前套用。

### Modified Capabilities

- `js-step-type`、`http-request-step`、以及與 step 解析/執行相關的既有 spec：改為「在統一節點介面下，內建 handler 的行為規格」；parser 不再對這些 type 做專用結構驗證，改由各 handler 或共用規則負責，若有現有 spec 描述 parser 對單一 type 的驗證，需改寫為「該 type 的 handler 輸入契約」或移除。
- （若專案內有「exec 執行」或「step 型別列舉」等獨立 spec，也需改為「執行僅依 registry」「step 型別為開放集合」。）

## Impact

- **@runflow/core**：`types.ts` 定義並匯出 **StepHandler、StepContext、StepResult、Registry**；`FlowStep` 改為通用 step 形狀；parser 產出統一 step 結構；executor 僅依 registry 分派，內建 command/js/http 改為獨立的 handler 模組並註冊到預設 registry；`run(flow, options)` 的 `options` 支援傳入 registry（預設為內建 registry）。
- **@runflow/cli**：使用 core 預設 registry 或擴充後傳入；**已支援**透過設定檔（`runflow.config.mjs` / `runflow.config.js` 的 `handlers`）與 `--registry <path>` 載入自訂 handler 並與預設 registry 合併；另提供 **examples/custom-handler** 範例（自訂 echo handler + config + flow）。
- **API**：對外僅暴露統一介面與預設 registry，不再暴露「三種內建 type 的專用型別」為第一公民；必要時仍可匯出內建 handler 供進階組合或測試。
