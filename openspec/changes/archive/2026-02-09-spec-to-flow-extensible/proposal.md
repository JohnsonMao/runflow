# Proposal: Spec-to-Flow Extensible

## Why

現有 Runflow 的 flow 需手動撰寫 YAML，當有大量來自同一規範的 API（例如 OpenAPI）時，無法直接重用既有定義。若能提供「約定格式 → flow」的轉換，並讓產出的 flow 可依需求擴充 API 執行前／中／後的步驟，即可在保持單一來源（如 openapi.yaml）的同時，用 Runflow 執行並擴充每個 API 的流程。

## What Changes

- 新增**約定格式轉 flow** 的能力：可將某種約定俗成的格式（例如 OpenAPI YAML）轉成 Runflow 的 flow 格式，使每個 API／操作對應一個可執行的 flow。
- 產出的 flow 可**依需求擴充**：在 **convention 轉換時**支援依 operation 在 API step 前／後插入自訂步驟（例如前置驗證、日誌、後處理），不同 operation 可插入不同 steps；且支援**僅產出到記憶體**（不寫檔），以因應 API 數量多的情境。
- 以**套件或介面**形式提供：轉換與擴充機制可被 CLI、MCP、或其它工具呼叫，方便整合。
- 不變更現有 step 類型與 executor 行為；新能力為純新增。

## Capabilities

### New Capabilities

- **convention-to-flow**: 從約定格式（如 OpenAPI YAML）產生 flow 的轉換規格與套件介面；定義輸入格式、如何將每個 API／操作對應為一可執行 flow（含 steps、params 等），以及與現有 loader/executor 的銜接方式。

- **flow-step-hooks**: 在 **convention 轉換時**依 operation 在 API step 前／後插入步驟的設定規格；不引入 step 的 `before`／`after` 欄位，由 adapter 依 hook 設定產出僅含 `dependsOn` 的 flow，且不同 operation 可設不同 steps。

### Modified Capabilities

- （無。現有 specs 如 http-request-step、flow-call-step、loader-resilience 等不變更需求；新能力在既有 flow/step 模型上疊加轉換與 hook 層。）

## Impact

- **新套件或 @runflow/core 擴充**：需實作 convention-to-flow 轉換器（例如 OpenAPI → flow），轉換時接受 hook 設定（依 operation 插入前／後 steps）並支援僅產出到記憶體；可能新增 `packages/convention-openapi` 或類似模組。core 不需新增 step 欄位或 hook 執行邏輯。
- **型別與 loader**：若 flow 由轉換動態產生，需與現有 loader、params schema、step context 相容。
- **CLI / 工具**：可提供「指定 openapi.yaml 產出 flow 並執行」的介面；產出可僅在記憶體（不寫檔）或寫入檔案供 `runflow run` 使用。
- **依賴**：視實作而定；若支援 OpenAPI，可能引入 YAML/JSON 解析或 OpenAPI 解析庫；盡量保持可選以控制依賴範圍。
