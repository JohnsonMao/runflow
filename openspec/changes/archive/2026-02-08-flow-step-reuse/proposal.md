# Proposal: Flow Step Reuse

## Why

目前單一 flow 只能定義自己的 steps，無法在一個 flow 內「呼叫」另一個 flow 或重用一組已定義的 steps。若要重用邏輯，只能複製 YAML 或把一切寫在同一個大 flow 裡，不利維護與模組化。實作「可執行其他 flow / 一組 steps」的能力，可讓 flow 以組合方式重用，符合 Runflow 作為可重用執行流程的目標。

## What Changes

- 新增 **step type**（例如 `flow` 或 `call-flow`），在執行時可呼叫並執行**另一個 flow**（依檔案路徑或識別子解析）。
- 被呼叫的 flow 可接收**參數**（由呼叫端傳入），並將其 **outputs** 合併回呼叫端 step 的結果，供後續 steps 使用。
- 可選：支援「只執行某個 flow 內指定的一組 step ids」作為 sub-flow，與現有 `runSubFlow` 語意一致，但來源可為另一檔案。
- 不變更現有 step 類型行為；新能力為純新增。

## Capabilities

### New Capabilities

- **flow-call-step**: 定義 `type: flow`（或 `call-flow`）的 step 規格：如何指定被呼叫的 flow（path / ref）、參數傳遞方式、輸出合併與錯誤處理，以及與現有 executor（DAG、when、nextSteps）的整合方式。

### Modified Capabilities

- （無。現有 specs 如 loop-step、condition-step、step-context 等不變更需求；新 step 使用既有 `StepContext` 與 `runSubFlow` 模型。）

## Impact

- **@runflow/core**：新增 flow-call step 的 handler、型別（若需新欄位）；可能需要從 `flowFilePath` 解析「另一份 flow 檔案」的 loader 或 resolver。
- **YAML 語法**：新 step 的 `flow` / `path` / `params` 等欄位需與現有 step 結構相容。
- **CLI**：若 flow 依路徑呼叫其他檔案，需確保工作目錄或 base path 一致（可能沿用現有 `flowFilePath` 或擴充選項）。
- **依賴**：無新外部依賴；僅使用既有 loader 與 executor。
