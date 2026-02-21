# Design: config handlers specPaths + merge spec

## Context

- **Current state**: Handlers 的 OpenAPI entry 使用單一 `specPath`；ResolvedFlow openapi 型別帶 specPath、openApiOperationKey 等；LoadedFlow 帶 flow、flowFilePath、openApiContext；runner 與 override handler 會收到 specPath / path / openApiSpecPath / openApiOperationKey。workspace 拆成 config.ts、resolveFlow.ts、loadFlow.ts 三檔。
- **Constraints**: CLI / MCP 共用 config 與 workspace；convention-openapi 已提供 openApiToFlows(specPath, options)；flow 範圍需明確（僅 flowsDir）。
- **Stakeholders**: 使用多 spec 合併的專案、override handler 作者、維護 workspace 的開發者。

## Goals / Non-Goals

**Goals:**
- 一個 handler entry 對應多個 spec（specPaths 陣列），載入時合併成一個 OpenAPI 後再 openApiToFlows；step type = entry key。
- ResolvedFlow / LoadedFlow 簡化：對外只暴露「如何載入」與「flow」，不暴露 specPath、openApiSpecPath、openApiOperationKey、path、flowFilePath。
- Flow 作業範圍僅由 config.flowsDir 決定；file-type flowId 一律在 flowsDir（或 cwd）內解析。
- workspace 收整：config、resolve、load 合併為單一模組或少數職責清晰的檔案。

**Non-Goals:**
- 不做 OpenAPI 合併的進階語意（例如 conflict 自動化解）；合併策略為「多檔 JSON 合併成一個 spec 物件」的明確規則即可。
- 不變更 core executor 或 step handler 的執行契約（仍為 step + context）；僅減少傳入的 context 欄位。
- 不在此 change 實作 specPath 的向後相容（可另做 migration 或文檔說明 specPath → specPaths）。

## Decisions

### 1. OpenAPI 合併策略與放置位置

- **Decision**: 在 **packages/workspace** 內實作「多個 spec 檔案路徑 → 讀取並轉 JSON → 合併成單一 OpenAPI 物件」；convention-openapi 僅負責接受單一 spec（檔案路徑或 in-memory 物件）並 openApiToFlows。
- **Rationale**: 合併是「解析/載入」的一環，與 configDir、flowsDir 等 workspace 職責一致；convention-openapi 保持「一 spec 一轉換」較單純。
- **Alternatives**: (A) 合併放在 convention-openapi：需新增 mergeSpecs(paths[]) 或 openApiToFlows 接受 spec 物件；(B) 合併放在 CLI/MCP：重複邏輯。選 workspace 可單一實作、單一測試。

### 2. 合併後的 spec 如何傳給 openApiToFlows

- **Decision**: workspace 合併後得到一個 OpenAPI 物件；若 convention-openapi 的 openApiToFlows 目前只接受檔案路徑，則在 workspace 內將合併結果寫入暫存檔（或 temp 路徑）再傳路徑，**或** 擴充 convention-openapi 使 openApiToFlows 接受 `spec: object`（第二參數或 options.spec）。優先考慮擴充 convention-openapi 接受 in-memory spec，避免暫存檔。
- **Rationale**: 暫存檔有清理與並發問題；in-memory 較乾淨。
- **Alternatives**: 僅用路徑則需寫入 temp 檔；若 convention-openapi 改為可接受 object 則無需 temp。

### 3. ResolvedFlow openapi 型別欄位

- **Decision**: ResolvedFlow 的 openapi 型別改為只帶 **specPaths**（resolved 路徑陣列）、**operation**、**options**（stepType、baseUrl、operationFilter、paramExpose）；**移除** specPath、openApiSpecPath、openApiOperationKey。載入端（loadFlowFromResolved）依 specPaths 做合併再呼叫 openApiToFlows。
- **Rationale**: 上層與 handler 不需要知道單一 spec 路徑或 operation key 的細節，只需能「依 ResolvedFlow 載入出 flow」。

### 4. LoadedFlow 與 createResolveFlow 回傳型別

- **Decision**: LoadedFlow 僅 **{ flow: FlowDefinition }**。createResolveFlow(flowId) 回傳 **Promise<{ flow } | null>**。移除 flowFilePath、openApiContext。
- **Rationale**: Runner 與 override handler 只需 flow 即可執行；不再傳遞 path/spec 相關欄位，簡化契約。

### 5. flowsDir 為 file-type 唯一範圍

- **Decision**: File-type flowId 的解析僅以 config.flowsDir（或無則 cwd）為 base；不再以「flow 的檔案路徑」限制後續讀取範圍。Discover、list、resolve 的 file 範圍一律為 flowsDir（或 cwd）。
- **Rationale**: 與 proposal 一致；避免 flowFilePath 語意殘留。

### 6. workspace 檔案收整

- **Decision**: 將 config.ts、resolveFlow.ts、loadFlow.ts 合併為 **單一檔案**（例如 `workspace.ts` 或保留 `config.ts` 作為對外入口並把 resolve/load 併入）。對外 export 維持不變（findConfigFile、loadConfig、resolveFlowId、createResolveFlow、resolveAndLoadFlow、discover、format*）。
- **Rationale**: 三檔職責高度相關（config 型別被 resolve/load 使用；resolve 與 load 成對出現），合併後較易維護；若單檔過大再依「config vs resolution vs load」拆成子模組但同一 package。
- **Alternatives**: 保留三檔但重新命名職責（例如 config.ts = config only；resolution.ts = resolve + load）— 若團隊偏好再採納。

## Risks / Trade-offs

- **[Risk] OpenAPI 合併時 path/operationId 衝突**  
  **Mitigation**: 合併時採用明確規則（例如後者覆蓋前者，或 prefix 命名）；文件寫明合併順序與衝突處理，必要時在 design 或 spec 補充。

- **[Risk] 現有 config 使用 specPath 的專案 break**  
  **Mitigation**: 本 change 為 **BREAKING**；migration 建議為將 `specPath: "x"` 改為 `specPaths: ["x"]`，可於 release note 與 docs 說明。

- **[Risk] Override handler 先前依賴 openApiContext 做 validateRequest**  
  **Mitigation**: 移除 openApiContext 後，若仍需驗證，需改為在 flow 或 step 上攜帶必要資訊（例如 operation schema 的引用），或由 convention-openapi 在產出的 step 上附加 metadata；此部分可列為後續改進，本 change 先移除傳遞。

## Migration Plan

1. **Code**: 依 tasks 順序實作 — convention-openapi 支援 in-memory spec（若需要）→ workspace 合併邏輯、ResolvedFlow/LoadedFlow 型別與實作、收整檔案 → CLI/MCP/flow-viewer 改為只消費 `flow`。
2. **Config**: 範例與文件將 `specPath` 改為 `specPaths`（陣列）；現有使用者需手動改 config。
3. **Rollback**: 若需回滾，還原 commit 並還原 config 格式即可；無資料庫或長期狀態。

## Open Questions

- convention-openapi 的 openApiToFlows 是否已支援「傳入 spec 物件」？若否，是否在本 change 內擴充為接受 `spec?: object`？
- 多 spec 合併時，若兩份 spec 都有 `paths./health`，合併規則是否為「後者覆蓋」或「error」？建議先採用後者覆蓋並在 spec 寫明。
