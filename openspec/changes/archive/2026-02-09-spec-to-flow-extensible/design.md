# Design: Spec-to-Flow Extensible

## Context

Runflow 目前以手寫 YAML flow 為主，loader 從檔案或字串載入單一 flow，executor 依 DAG 執行 steps。已有 step 類型：command、js、http、flow（call-flow）、condition、loop、set、sleep 等；params 與 template substitution 已支援。需求是：讓「約定格式」（如 OpenAPI）能轉成 flow；在**轉換時**可依 operation 在 API step 前／後插入自訂步驟（不同 operation 可不同），且支援僅產出到記憶體以因應 API 數量多的情境。受眾為 CLI、未來 MCP、或腳本呼叫者。

## Goals / Non-Goals

**Goals:**

- 提供 convention-to-flow 轉換介面與實作（至少 OpenAPI 3.x → flow），產出可被現有 executor 執行的 flow。
- 在 convention 轉換時支援依 operation 插入 API 前／後步驟（hook 設定），產出僅含 `dependsOn` 的合法 Runflow；不同 operation 可設不同 steps。
- 支援僅產出到記憶體（不寫檔），以因應 API 數量多的情境。
- 與現有 @runflow/core loader、executor、step 型別相容；不引入 step 的 before/after 欄位，不破壞既有行為。

**Non-Goals:**

- 支援所有 OpenAPI 進階特性（e.g. callbacks、linked schemas）於第一版；先覆蓋 path + method + params + requestBody 即可。
- 在 step 上新增 `before`／`after` 欄位或讓 executor 解讀 hook；hook 僅在轉換階段由 adapter 處理。
- 強制將 convention 轉換內建到 core；可為獨立套件依賴 core，core 不需改動。

## Decisions

### 1. Convention-to-flow 以獨立套件實作，core 不直接解析 OpenAPI

**決策**：新增 `packages/convention-openapi`（或 `@runflow/openapi`）套件，負責讀取 OpenAPI 文件、產出 flow 物件；@runflow/core 僅負責執行 flow，不解析 OpenAPI。

**理由**：保持 core 單一職責、依賴最小；其他約定（AsyncAPI、自訂 YAML）可另建套件。  
**替代**：在 core 內建 OpenAPI 解析 → 會增加 core 依賴與複雜度，不採納。

### 2. 每個 OpenAPI operation 對應一個 flow（一 flow 一 operation）

**決策**：adapter 介面為「給定 OpenAPI 文件 + 可選 operation 篩選」→ 回傳多個 flow（每個 path+method 一個），或單一 flow 若呼叫端指定單一 operation。

**理由**：與「每個 API 可轉成可使用的 flow」一致；caller 可選「全部產出」或「只產出 GET /users」。  
**替代**：一個大 flow 內多個 step 對應多個 operation → 可選實作，但預設以「一 flow 一 operation」利於重用與參數對齊。

### 3. 產出 flow 使用既有 http step；不新增「openapi step」類型

**決策**：convention-to-flow 產出的 step 為 `type: http`（及必要時 `js`），url/method/headers/body 從 OpenAPI 對應填入；params 對應到 flow 的 `params` 宣告。

**理由**：http-request-step 已滿足需求；避免在 core 新增 openapi 專用 step 類型。  
**替代**：新增 `type: openapi` → 增加 core 與 spec 複雜度，不採納。

### 4. Hooks 僅在轉換時由 adapter 處理，不新增 step 的 before/after 欄位

**決策**：不在 step 上新增 `before`／`after` 欄位。轉換時由 convention-to-flow adapter 接受 **hook 設定**（依 operation 指定要插入的 before/after step 定義），adapter 產出的 flow 已包含這些 steps 並以 `dependsOn` 排好順序；executor 只跑既有 DAG，不需解讀任何 hook 欄位。

**理由**：core 與 flow schema 不變；擴充邏輯集中在 adapter，不同 operation 可設不同 steps，且產出永遠是合法 Runflow。  
**替代**：step 上 before/after + loader 展開 → 需改 parser/loader，且與「依 operation 不同 steps」較難對應，不採納。

### 5. 產出模式：支援僅產出到記憶體

**決策**：adapter 的 options 支援「僅產出到記憶體」（例如 `output: 'memory'` 或不傳 `outputDir`）。在此模式下 adapter 回傳 flow 物件（或 Map/陣列），不寫入檔案；caller 可依 operation 選單一 flow 執行或遍歷全部。預設或可選設為 memory，以因應 API 數量多時避免寫出大量檔案。

**理由**：API 很多時只產出到記憶體可省 I/O、利於程式化呼叫與篩選。  
**遷移**：同時保留「寫入 outputDir」選項供需要持久化 YAML 的情境。

### 6. Hook 設定格式（adapter 選項）

**決策**：hook 設定以 adapter 的 options 傳入，例如 `hooks: { '<operationKey>': { before: StepDef[], after: StepDef[] } }`，其中 operationKey 為 path+method 或 operationId；StepDef 為 Runflow step 形狀（id, type, run/url/...）。adapter 在產出每個 operation 的 flow 時，將對應的 before/after steps 插入並設好 `dependsOn`，產出單一 flow 物件。

**理由**：不同 operation 可插入不同 steps；無需新檔案格式，程式化呼叫時直接傳入。  
**替代**：獨立的 hook 設定檔 → 可作為後續增強，第一版以 options 傳入即可。

StepDef 的 step id：若使用者有提供，adapter 以使用者提供的為主；若未提供，adapter SHALL 自動生成唯一 id（例如依 operationKey 前綴或遞增後綴），避免同一 flow 內 id 衝突。

### 7. 依賴：OpenAPI 解析

**決策**：convention-openapi 套件可依賴輕量 OpenAPI 解析（例如只讀 paths、operations、parameters、requestBody），或使用現成庫（如 openapi-types、或最小自幹 parser）。優先選無龐大依賴的方案；若用現成庫，列為 optionalPeer 或放在 adapter 層以 lazy load 降低對 core 的影響。

**理由**：控制依賴範圍、建置與安全更新成本。  
**替代**：core 依賴 OpenAPI 官方 SDK → 過重，不採納。

## Risks / Trade-offs

- **[Risk] OpenAPI 格式差異大（2.0 vs 3.0、不同風格）→ 轉換漏欄位或錯誤**  
  Mitigation: 第一版明確定義支援範圍（e.g. OpenAPI 3.0 path+method+params+requestBody）；文件標註不支援項目；必要時用 adapter 選項切換行為。

- **[Risk] 轉換時 hook step id 與 API step id 衝突或 DAG 環**  
  Mitigation: adapter 在插入 before/after steps 時為 step id 加前綴或後綴（例如依 operationKey），並檢查 acyclic；若提供共用 step 定義則 clone 並賦予唯一 id。

- **[Risk] 產出 flow 過多（數百 operations）導致檔案或記憶體負擔**  
  Mitigation: adapter **必須**支援「僅產出到記憶體」模式（不寫檔）；並支援篩選（by path/method/tag）或只產出單一 operation，caller 可依需取得單一 flow 或迭代全部。

## Migration Plan

- 新功能為純新增：無既有 flow 必須遷移；core 不新增 step 欄位，無向後相容顧慮。
- 發佈順序建議：先實作 convention-to-flow adapter（含 OpenAPI、hook 設定、僅產出到記憶體），再補 CLI 參數（如 `--from-openapi`）與文件。

## Open Questions

- （無其他待決項。）
