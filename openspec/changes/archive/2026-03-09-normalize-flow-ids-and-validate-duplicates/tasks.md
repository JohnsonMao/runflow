## 1. 建立 Flow ID 正規化函數

- [x] 1.1 根據「正規化函數的位置與命名」決策，在 `packages/workspace/src/` 下建立新檔案 `normalizeFlowId.ts`
- [x] 1.2 根據「正規化規則的實作順序」決策，實作 `normalizeFlowId` 函數，處理 URL 解碼和特殊符號轉換（保留 `-`, `_`, `.`），實作「The system SHALL provide a Flow ID normalization function」需求
- [x] 1.3 實作連續底線合併和首尾底線移除邏輯
- [x] 1.4 根據「[風險] URL 解碼可能失敗」風險緩解措施，加入錯誤處理，當 URL 解碼失敗時優雅降級
- [x] 1.5 匯出 `normalizeFlowId` 函數供其他模組使用

## 2. 為正規化函數撰寫單元測試

- [x] 2.1 建立 `packages/workspace/src/normalizeFlowId.test.ts`
- [x] 2.2 測試 URL 編碼字元的解碼和正規化（如 `tt%2Fpost-users.yaml` → `tt_post-users.yaml`）
- [x] 2.3 測試保留字元（`-`, `_`, `.`）不被轉換
- [x] 2.4 測試連續底線合併和首尾底線移除
- [x] 2.5 測試無效 URL 編碼的錯誤處理
- [x] 2.6 測試各種邊界情況（空字串、只有特殊符號等）

## 3. 修改 OpenAPI operation key 生成邏輯

- [x] 3.1 在 `packages/convention-openapi/src/collectOperations.ts` 中匯入 `normalizeFlowId`
- [x] 3.2 根據「OpenAPI operation key 正規化的時機」決策，修改 `toOperationKey` 函數，在返回前對 operation key 進行正規化，實作「Operation keys SHALL be normalized」需求
- [x] 3.3 確保正規化後的 operation key 符合 flow-id-normalization 規範，確保「The system SHALL provide a convention-to-flow adapter interface」需求中的 operation key 正規化

## 4. 修改 Flow YAML ID 正規化邏輯

- [x] 4.1 在 `packages/workspace/src/discover.ts` 中匯入 `normalizeFlowId`
- [x] 4.2 根據「Flow YAML ID 正規化的時機」決策，修改 `buildDiscoverCatalog` 函數，在讀取 Flow ID 後立即進行正規化（Line 128），實作「Flow IDs SHALL be normalized during catalog discovery」需求
- [x] 4.3 修改 OpenAPI handler Flow ID 的處理邏輯，對整個 `handlerKey:operationKey` 字串進行正規化（Line 173）

## 5. 增強重複 ID 檢查機制

- [x] 5.1 根據「重複 ID 檢查的增強」決策和「[風險] 正規化後的 ID 可能與現有 ID 衝突」風險緩解措施，修改 `buildDiscoverCatalog` 中的重複檢查邏輯，使用正規化後的 ID 作為 `idMap` 的 key，實作「The system SHALL validate for duplicate Flow IDs after normalization」需求
- [x] 5.2 增強錯誤訊息格式，包含正規化後的 ID、原始 ID 和來源位置
- [x] 5.3 確保第一個出現的正規化 ID 被接受，後續重複的標記錯誤

## 6. 型別安全改進

- [x] 6.1 檢查 `packages/convention-openapi/src/collectOperations.ts` 中的 `any` 型別使用（已確認使用 `Record<string, unknown>`，型別安全）
- [x] 6.2 檢查 `packages/workspace/src/discover.ts` 中的型別定義（已確認使用明確的 `FlowStep` 型別）
- [x] 6.3 將所有不必要的 `any` 型別改為明確的型別定義（未發現 `any` 型別使用）
- [x] 6.4 移除冗余的型別斷言和未使用的程式碼（未發現冗余程式碼）
- [x] 6.5 根據「[權衡] 正規化的嚴格程度」決策，確保正規化規則符合專案需求（已實作）

## 7. 整合測試

- [x] 7.1 測試 OpenAPI 轉換流程，確保 operation key 經過正規化
- [x] 7.2 測試 Flow YAML 檔案發現流程，確保 Flow ID 經過正規化
- [x] 7.3 測試重複 ID 偵測，確保正規化後的 ID 能正確識別重複
- [x] 7.4 測試錯誤訊息，確保包含足夠的除錯資訊
- [x] 7.5 根據「[風險] 現有 Flow ID 的相容性問題」風險，測試現有 Flow ID 的相容性

## 8. 驗證與清理

- [x] 8.1 執行 `pnpm run check` 確保所有檢查通過（workspace 和 convention-openapi 套件通過）
- [x] 8.2 修正任何型別錯誤或 lint 錯誤（已修正所有相關錯誤）
- [x] 8.3 確認所有測試通過（所有相關測試通過）
- [x] 8.4 檢查是否有遺漏的邊界情況或錯誤處理（已涵蓋所有邊界情況）
