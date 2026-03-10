## Why

目前系統在處理 Flow ID 時存在兩個問題：首先，從 OpenAPI 規格轉換而來的 operation key 可能包含 URL 編碼的特殊符號（如 `%2F`, `%3A`），這些符號在作為 Flow ID 使用時不夠友善且可能造成解析問題；其次，雖然系統已有重複 ID 的偵測機制，但缺乏主動的正規化處理，導致相同邏輯的 Flow 可能因為 ID 格式不一致而無法被正確識別。此外，在重構過程中發現部分程式碼使用 `any` 型別或存在冗余邏輯，需要一併修正以提升型別安全性和程式碼品質。

## What Changes

- **新增 Flow ID 正規化機制**：建立統一的 ID 正規化函數，將所有特殊符號（URL 編碼字元、路徑分隔符等）轉換為底線 `_`，但保留連字號 `-`、底線 `_` 和點號 `.` 不變
- **OpenAPI operation key 正規化**：修改 `toOperationKey` 函數，在生成 operation key 時自動進行正規化處理
- **Flow YAML ID 正規化**：在 `buildDiscoverCatalog` 中，對從 Flow YAML 檔案讀取的 `id` 欄位進行正規化
- **重複 ID 驗證增強**：在正規化後進行重複 ID 檢查，確保正規化後的 ID 不會產生衝突
- **型別安全改進**：修正程式碼中不必要的 `any` 型別使用，改為明確的型別定義
- **程式碼清理**：移除冗余的邏輯和未使用的程式碼

## Capabilities

### New Capabilities

- `flow-id-normalization`: Flow ID 正規化與驗證機制，提供統一的 ID 格式轉換規則和重複檢查功能

### Modified Capabilities

- `convention-to-flow`: 修改 OpenAPI 轉換流程，確保生成的 operation key 經過正規化處理

## Impact

- **Affected specs**: 
  - `flow-id-normalization` (新增)
  - `convention-to-flow` (修改)
- **Affected code**:
  - `packages/convention-openapi/src/collectOperations.ts`: 修改 `toOperationKey` 函數以加入正規化邏輯
  - `packages/workspace/src/discover.ts`: 修改 `buildDiscoverCatalog` 以正規化 Flow ID 並增強重複檢查
  - `packages/workspace/src/config.ts`: 可能需要調整 `resolveFlowId` 以支援正規化後的 ID
  - 其他使用 Flow ID 的相關檔案：需要確保正規化後的 ID 在整個系統中一致使用
