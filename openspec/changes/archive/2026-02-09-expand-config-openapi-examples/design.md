# Design: Expand Config (OpenAPI) & Converge Examples

## Context

- Runflow CLI 目前透過 `runflow.config.mjs` 僅支援 `handlers`（自訂 step 註冊）；OpenAPI 流程則完全由 CLI 參數 `--from-openapi`、`--operation` 驅動，spec 路徑與選項未與 config 整合。
- `@runflow/convention-openapi` 的 `openApiToFlows(specPath, options)` 支援 `output`、`baseUrl`、`operationFilter`、`hooks` 等選項，目前 CLI 呼叫時僅傳 `output: 'memory'`，其餘由命令列無法指定。
- `examples/` 目前約十餘個 YAML/目錄，部分功能重疊（如多個 params/dag 範例），新手上手與維護成本高。

## Goals / Non-Goals

**Goals:**

- 在 runflow config 中新增 `openapi` 區塊，可設定預設 spec 路徑、輸出目錄、以及傳給 `openApiToFlows` 的選項（如 `baseUrl`、`operationFilter`、`hooks`），並讓 CLI 在 `--from-openapi` 時優先採用 config，再以 CLI 參數覆寫。
- 將 `examples/` 收斂為少數具代表性範例，涵蓋：基本 flow、參數/schema、DAG、HTTP、JS step、自訂 handler；其餘移除或合併，並更新 README/文件指向收斂後清單。

**Non-Goals:**

- 不在此變更內實作 YAML config 格式（仍以 `runflow.config.mjs` 為主）；不變更 `openApiToFlows` 的對外 API 簽名。
- 不新增與 OpenAPI 無關的 config 區塊（例如 runner 或 logging）；僅擴充與 OpenAPI 相關欄位。註：後續在此 change 內一併加入 `allowedCommands`（command 安全性）為 config 頂層欄位。

## Decisions

1. **Config 結構 `openapi`**
   - 採用單一 `openapi` 物件，欄位對齊 `OpenApiToFlowsOptions` 常用項，並加上「預設 spec 與輸出」：
     - `specPath`（可選）：預設 OpenAPI spec 檔案路徑（相對 config 所在目錄或絕對）。
     - `outDir`（可選）：產生 flow 檔案時的預設輸出目錄（對應 `output: { outputDir }`）。
     - `baseUrl`、`operationFilter`、`hooks`（可選）：直接對應 `openApiToFlows` 的 options，由 CLI 載入 config 時傳入。
   - **理由**：單一區塊易於擴充、與現有 `handlers` 並存；路徑相對於 config 檔案目錄可避免 cwd 歧義。
   - **替代**：將 openapi 拆成多個頂層 key（如 `openapiSpecPath`）— 捨棄，因選項會變多，不利於之後加 `hooks` 等複雜結構。

2. **CLI 與 config 的優先順序**
   - 當使用者提供 `--from-openapi <path>` 時：spec 路徑以 CLI 為準；其餘選項（baseUrl、operationFilter、hooks、outDir）先從 config 的 `openapi` 讀取，再以未來 CLI 旗標（若有）覆寫。
   - 當使用者未提供 `--from-openapi` 但 config 有 `openapi.specPath`：不自動執行 OpenAPI flow（仍要求顯式 `--from-openapi` 或未來子命令），僅用 config 提供預設值。
   - **理由**：保持「一次 run 一個 flow」的語意，避免隱性行為；預設值來自 config 可減少重複輸入。

3. **Config 的 allowedCommands（command 安全性）**
   - 在 config 頂層新增 `allowedCommands?: string[]`。CLI 載入 config 後將該陣列傳給 `run(flow, { allowedCommands })`；engine 將之放入 step context，command handler 依此限制可執行的指令（比對 run 字串的第一個 token 的 basename）。
   - 未設定時：handler 使用預設最小安全清單（如 `echo`, `exit`, `true`, `false`）。設為空陣列時：不允許任何 command step。
   - **理由**：預設限制可執行指令以降低風險；需跑 node/python 等時由使用者於 config 明確列出。

4. **Examples 收斂策略**
   - 保留類型：hello（基本）、params + params-schema（參數與 schema）、dag（一個線性一個並行或合併為一個）、http、js-file、custom-handler（目錄）；其餘如 mixed-flow、new-steps-flow、condition-flow 等視為與上述重疊或可合併，決定後於 tasks 列出刪除/合併清單。
   - 目錄結構：維持扁平 YAML + 單一子目錄 `custom-handler/`；不新增多層子目錄。
   - **理由**：代表性涵蓋主要 capability，數量控制在約 6–8 個；README 與文件只列保留範例，避免過時連結。

5. **破壞性與遷移**
   - 若刪除既有 example 檔案：在 Impact/README 註明「已移除的 examples」與對應替代範例（若有）。不變更 config 或 CLI 的既有欄位名稱，故無 config **BREAKING**。
   - 若未來重新命名 `openapi` 欄位：將在該 change 標註 **BREAKING** 並提供遷移步驟。

## Risks / Trade-offs

- **Risk**: Config 與 CLI 選項重複（spec path、outDir 等），使用者可能困惑誰優先。  
  **Mitigation**: 在文件與 help 中明確寫明「CLI 參數覆寫 config」，並在設計上僅讓 CLI 覆寫、不讓 config 覆寫 CLI。

- **Risk**: Examples 收斂時刪除的檔案若被外部文件或腳本引用會 404。  
  **Mitigation**: 在 tasks 中列出一份「已移除檔案 → 請改用 XXX」對照，並在 PR/README 簡短說明。

- **Trade-off**: 不實作「僅從 config 推斷 openapi 而不給 --from-openapi」可減少實作與測試範圍，但使用者仍需打 `--from-openapi`（或未來子命令）；可接受。

## Migration Plan

1. 實作 config 擴充與 CLI 讀取：新增 `openapi` 型別與載入邏輯，CLI 呼叫 `openApiToFlows` 時傳入合併後選項；無需資料遷移。
2. Examples 收斂：依 tasks 清單刪除/合併檔案，更新 `examples/README.md`（若有）及主 README 的 examples 連結；建議在單一 PR 內完成並註明「Removed examples: …」。
3. 回滾：若僅 examples 變更，還原該 PR 即可；若 config 已發布，保留 `openapi` 為可選向後相容，無需回滾程式碼。

## Open Questions

- `hooks` 在 config 中若為陣列（HooksEntry[]），路徑（如 handler 模組）是否一律相對 config 目錄？建議：是，與 `handlers` 一致。
- Examples 中「dag」保留一個還是兩個（linear + parallel）？建議：保留兩個以分別展示依賴與並行，tasks 階段定案。
