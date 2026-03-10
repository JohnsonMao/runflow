## Context

目前系統中 Flow ID 的來源有兩種：
1. **Flow YAML 檔案**：從檔案路徑或 YAML 中的 `id` 欄位取得
2. **OpenAPI 轉換**：透過 `toOperationKey` 函數從 OpenAPI path 和 method 生成 operation key，格式為 `handlerKey:operationKey`

現有問題：
- OpenAPI path 可能包含 URL 編碼字元（如 `%2F`, `%3A`），這些字元在 `toOperationKey` 中沒有被處理，導致生成的 ID 包含特殊符號
- Flow YAML 中的 `id` 欄位可能包含各種特殊符號，沒有統一的正規化處理
- 雖然 `buildDiscoverCatalog` 已有重複 ID 檢查，但檢查發生在正規化之前，可能導致相同邏輯的 Flow 因為格式不同而被視為不同 ID

## Goals / Non-Goals

**Goals:**

- 建立統一的 Flow ID 正規化機制，確保所有 Flow ID 符合一致的格式規範
- 將 URL 編碼字元（如 `%2F`, `%3A`）解碼後再進行正規化
- 保留連字號 `-`、底線 `_` 和點號 `.` 不變，其他特殊符號轉換為底線 `_`
- 在正規化後進行重複 ID 檢查，確保不會產生衝突
- 修正程式碼中不必要的 `any` 型別使用，提升型別安全性

**Non-Goals:**

- 不改變現有的 Flow ID 解析邏輯（`resolveFlowId` 的整體行為保持不變）
- 不影響現有的 Flow 執行邏輯
- 不進行大規模的 ID 遷移（正規化在運行時進行，不修改現有檔案）

## Decisions

### 正規化函數的位置與命名

**決策**：在 `packages/workspace/src/` 下建立新檔案 `normalizeFlowId.ts`，匯出 `normalizeFlowId` 函數。

**理由**：
- `workspace` 套件負責 Flow ID 的解析和發現邏輯，正規化函數應該放在這裡
- 獨立檔案便於測試和維護
- 可以被 `convention-openapi` 和 `workspace` 兩個套件使用

**替代方案考慮**：
- 放在 `packages/core`：但 core 不應該知道 ID 格式的具體規則
- 放在 `packages/convention-openapi`：但這樣 workspace 無法使用

### 正規化規則的實作順序

**決策**：先進行 URL 解碼，再進行特殊符號轉換。

**理由**：
- URL 編碼字元（如 `%2F`）需要先解碼成對應字元（`/`），才能正確處理
- 解碼後再統一處理所有特殊符號，邏輯更清晰

**實作步驟**：
1. 使用 `decodeURIComponent` 解碼 URL 編碼字元
2. 將所有特殊符號（除了 `-`, `_`, `.`）轉換為 `_`
3. 處理連續的底線（將多個連續的 `_` 合併為單一個 `_`）
4. 移除開頭和結尾的底線

**替代方案考慮**：
- 只處理特定符號：但這樣無法涵蓋所有邊界情況
- 使用正則表達式一次處理：但先解碼再處理更安全

### OpenAPI operation key 正規化的時機

**決策**：在 `toOperationKey` 函數內部，生成 operation key 後立即進行正規化。

**理由**：
- 確保所有從 OpenAPI 生成的 operation key 都經過正規化
- 不需要修改所有呼叫 `toOperationKey` 的地方
- 保持函數的單一職責（生成並正規化 operation key）

**替代方案考慮**：
- 在 `collectOperations` 中正規化：但這樣會讓 `toOperationKey` 的輸出不一致
- 在 `buildDiscoverCatalog` 中正規化：但這樣 OpenAPI 轉換的結果就不一致

### Flow YAML ID 正規化的時機

**決策**：在 `buildDiscoverCatalog` 中，讀取 Flow ID 後立即進行正規化，然後再進行重複檢查。

**理由**：
- 確保所有 Flow ID（無論來源）都經過正規化
- 正規化後的重複檢查更準確
- 不需要修改 Flow YAML 檔案本身

**實作位置**：
- Line 128：`const flowId = flow.id || rel || filePath` 之後，立即正規化
- Line 173：`const flowId = \`${key}:${operationKey}\`` 之後，立即正規化（但 `operationKey` 已經在 `toOperationKey` 中正規化過，所以這裡只需要正規化整個 `flowId` 字串）

### 重複 ID 檢查的增強

**決策**：在正規化後進行重複檢查，並提供更詳細的錯誤訊息。

**理由**：
- 正規化後的 ID 才能正確識別重複
- 錯誤訊息應該包含原始 ID 和正規化後的 ID，方便除錯

**實作**：
- 使用正規化後的 ID 作為 `idMap` 的 key
- 錯誤訊息格式：`Duplicate flowId: ${normalizedId} (original: ${originalId}, already defined in ${source})`

### 型別安全改進

**決策**：在實作過程中，將所有不必要的 `any` 型別改為明確的型別定義。

**理由**：
- 提升程式碼的型別安全性
- 減少執行時錯誤的可能性
- 符合專案的型別安全標準

**重點檢查區域**：
- `packages/convention-openapi/src/collectOperations.ts`：Line 24 `operation: Record<string, unknown>`
- `packages/workspace/src/discover.ts`：Line 145, 188 `flow.steps.map((s: FlowStep) => ...)` 中的型別推斷
- 其他使用 `any` 或過於寬鬆型別的地方

## Risks / Trade-offs

### [風險] 現有 Flow ID 的相容性問題

**風險**：如果現有系統或工具依賴特定的 Flow ID 格式，正規化可能會破壞這些依賴。

**緩解措施**：
- 正規化只在運行時進行，不修改現有檔案
- 如果發現相容性問題，可以在配置中提供選項來停用正規化（但預設啟用）
- 在錯誤訊息中提供原始 ID 和正規化後的 ID，方便除錯

### [風險] URL 解碼可能失敗

**風險**：如果 Flow ID 包含無效的 URL 編碼字元，`decodeURIComponent` 可能會拋出錯誤。

**緩解措施**：
- 使用 try-catch 包裹解碼邏輯，如果解碼失敗則跳過解碼步驟
- 記錄警告訊息但不中斷流程

### [風險] 正規化後的 ID 可能與現有 ID 衝突

**風險**：兩個不同的原始 ID 經過正規化後可能變成相同的 ID。

**緩解措施**：
- 這正是重複檢查要解決的問題
- 如果發現衝突，在錯誤訊息中明確標示所有衝突的原始 ID
- 考慮在錯誤訊息中建議如何修改原始 ID 以避免衝突

### [權衡] 正規化的嚴格程度

**權衡**：保留 `-`, `_`, `.` 的決定是基於常見的檔案命名慣例，但可能不適用於所有情況。

**決策**：先實作這個規則，如果發現問題再調整。這個規則符合大多數使用場景，且可以透過配置擴展。

## Migration Plan

1. **實作正規化函數**：在 `packages/workspace/src/normalizeFlowId.ts` 中實作 `normalizeFlowId` 函數
2. **修改 `toOperationKey`**：在 `packages/convention-openapi/src/collectOperations.ts` 中，修改 `toOperationKey` 函數以使用正規化函數
3. **修改 `buildDiscoverCatalog`**：在 `packages/workspace/src/discover.ts` 中，在讀取 Flow ID 後立即進行正規化
4. **增強重複檢查**：修改重複檢查邏輯，使用正規化後的 ID 並提供更詳細的錯誤訊息
5. **型別安全改進**：在實作過程中，修正所有不必要的 `any` 型別
6. **測試**：撰寫單元測試和整合測試，確保正規化邏輯正確且不會破壞現有功能
7. **驗證**：執行 `pnpm run check` 確保所有檢查通過

## Open Questions

1. **是否需要支援配置選項來停用正規化？**
   - 目前決定預設啟用，如果發現需要可以後續加入配置選項

2. **正規化後的 ID 是否需要寫回 Flow YAML 檔案？**
   - 目前決定不寫回，只在運行時正規化。如果後續需要可以考慮加入選項

3. **是否需要提供工具來批次正規化現有的 Flow ID？**
   - 目前不在範圍內，如果後續需要可以考慮加入
