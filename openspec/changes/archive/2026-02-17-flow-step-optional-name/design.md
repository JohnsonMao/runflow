## Context

FlowStep 目前僅有引擎與 handler 相關欄位（id, type, dependsOn, skip, timeout, retry, outputKey）；顯示用欄位付之闕如。flow-graph 由 `flowDefinitionToGraph` 產出，節點 `label` 目前固定為 `stepId (type)` 或 `stepId`，無 step 級別的可讀名稱或說明。CLI、MCP、flow-viewer 若需顯示 step 說明，只能依賴 id/type。本變更在不改動執行語意的前提下，為 FlowStep 與圖節點加入選用的 name/description，並由各消費者自行決定是否顯示。

## Goals / Non-Goals

**Goals:**

- FlowStep 型別與 YAML 支援選用 `name`、`description`，語意僅供顯示/文件。
- 圖節點 label 在有 `step.name` 時使用 name，否則維持既有 fallback（id 或 "id (type)"）；節點可帶 `description` 供 tooltip/詳情。
- Parser/loader 保留並傳遞 name、description，不影響既有驗證。
- 消費者（flow-graph、CLI、MCP、flow-viewer）可依規格使用 name/description，實作先後可分開。

**Non-Goals:**

- 不在 executor、handler 或 step-context 語意中使用 name/description（不影響 context key、DAG、執行）。
- 不強制 CLI/MCP/viewer 必須顯示 description（實作可選）。
- 不規定 description 的 Markdown 渲染方式（由各消費者自訂）。

## Decisions

### 1. name / description 僅為顯示用，不列為 engine-reserved

**決策**：`name`、`description` 不列入 engine-reserved 清單，與 `outputKey`、`skip` 等區分；註解中標明「display/documentation only」。

**理由**：engine 與 handler 完全不讀這兩個欄位，僅消費者（圖、CLI、MCP、UI）使用，避免與「執行語意」混淆。

**替代**：列為 engine-reserved → 會讓文件與程式註解暗示 engine 有特殊處理，易造成誤解，故不採。

### 2. 圖節點 label 優先使用 step.name，再 fallback 既有邏輯

**決策**：`flowDefinitionToGraph` 產出 node 時，`label = step.name ?? (type ? \`${stepId} (${type})\` : stepId)`。

**理由**：與 flow-graph-format 的「label 在 step 有 name 時應使用 step.name」一致；未提供 name 時行為與現有一致。

**替代**：一律只用 id → 無法滿足「可讀標籤」需求。

### 3. 圖節點新增選用欄位 description

**決策**：FlowGraphNode 新增 `description?: string`，由 `step.description` 帶入；產圖時若 step 有 description 則設於 node，否則不設。

**理由**：tooltip、詳情頁需要一處可讀的說明文字，放在 node 上與 flow-graph-format 的「node MAY include description」對齊。

**替代**：不帶入圖、僅在 step 層保留 → 消費者需另從 flow.steps 查 step.description，圖格式與 step 脫鉤，不利單一資料源。

### 4. Parser / loader 不特別驗證 name、description

**決策**：不新增必填或格式驗證；現有 loader 若為「允許未知欄位」的寬鬆模式，name/description 會自然保留；若有白名單，則將兩者加入允許清單。

**理由**：兩者皆為選用字串，過度驗證（長度、字元集）效益低，且可能妨礙未來多語或 Markdown。

**替代**：嚴格驗證（例如 name 長度上限）→ 留待日後若有需求再在 spec 中補上。

## Risks / Trade-offs

- **[Risk]** 消費者實作不一致（有的顯示 name、有的不顯示）→ **Mitigation**：flow-graph-format 與 step-display-metadata spec 明確定義 label/description 語意；各 app 依規格實作，可分批上線。
- **[Risk]** description 若含大量 Markdown 或特殊字元，可能影響某些 UI 或 API 輸出 → **Mitigation**：spec 不規定必須渲染 Markdown；消費者可選擇純文字或有限 Markdown，必要時做 sanitize。
- **[Trade-off]** 圖結構略變大（每個 node 可多一個 description 字串）→ 僅在 step 有填 description 時才有，且為選用，可接受。

## Migration Plan

- 無資料遷移：既有 YAML 不填 name/description 即維持原行為。
- 部署順序建議：先合併 core（型別 + flowGraph label/description）、再更新依賴 core 的 workspace/cli/mcp/flow-viewer；消費者可擇期顯示 name/description。

## Open Questions

- 無；若日後 CLI/MCP 要輸出 step name/description 的欄位命名，可依既有 API 風格決定（例如 `stepName`、`stepDescription` 或併入現有 step 物件）。
