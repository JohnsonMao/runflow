# Proposal: OpenAPI params filter and override (no hooks)

## Why

1. **Params 暴露需可配置**：目前 OpenAPI 產生的 flow 會把 path、query、header、body 都放進 flow.params；workspace 的 format 則硬編碼只顯示 path/query/body。希望改由**設定檔**控制哪些 param 種類要暴露或隱藏（預設 path、query、body 暴露，header、cookie 隱藏），不需在 workspace 端過濾。
2. **單一 override 取代 hooks**：hooks（before/after）尚未有人使用，可直接移除。改為 **override**：一個與 custom-handler 同型的函數（validate、kill、run），接收與 http 相同的 step 參數（url、method、headers、body），可做權限注入、請求改寫、以及依 OpenAPI request 的動態 validate。
3. **動態 validate 依 context**：override 需要依 OpenAPI request schema 做驗證；**validateRequest 所需資訊（spec 路徑、operation key）透過 context 傳遞**，由 executor 或 resolver 在執行 OpenAPI 衍生 flow 時注入，override 從 context 讀取後再呼叫驗證邏輯。

## Recommendation

- **移除 hooks**：從 config、types、openApiToFlows、applyHooks 等處完全移除 hooks 相關程式與規格；不再支援 before/after。
- **paramExpose**：在 openapi 每 prefix 的選項中新增 `paramExpose`（例如 `{ path?: boolean, query?: boolean, body?: boolean, header?: boolean, cookie?: boolean }`）。預設 path、query、body 為 true，header、cookie 為 false。產生 flow 時只將「暴露」的 param 放進 flow.params；隱藏的可由 override 或 context 在執行時注入。
- **override**：在 openapi 每 prefix 的選項中新增 `override`（字串：handler 名稱或模組路徑）。若設定，該 operation 的 API step 改為使用此 override 作為 step handler；step 的 payload 與 http 一致（url、method、headers、body），並由執行時 **context** 注入 `openApiSpecPath`、`openApiOperationKey`，供 override 做 validateRequest。
- **validateRequest 透過 context**：執行 OpenAPI 衍生 flow 且該 step 為 override 時，呼叫 handler 前在 context 注入 `openApiSpecPath`、`openApiOperationKey`（或等同欄位）。Override 的 run(step, context) 可讀取這些欄位並呼叫 convention-openapi 提供的 validateRequest(step, context)（或依 context 內 specPath/operationKey 自行載入 spec 驗證），再決定是否發送請求或回傳錯誤。

## What Changes

- **Config / types**：openapi 每 prefix 支援 `paramExpose`（可選，預設 path/query/body 暴露、header/cookie 隱藏）、`override`（可選，handler 名或路徑）。移除 `hooks`。
- **convention-openapi**：移除 hooks（resolveHooks、applyHooks、OperationHooks、HooksEntry 等）；mapParams 後依 paramExpose 過濾 flow.params；若有 override，產生的 step 為 override 的 type，payload 同 http，不寫入 specPath/operationKey 到 step（改由 context 傳遞）。提供 validateRequest(step, context) 或等同 API，供 override 模組使用。
- **Resolver / executor**：在解析或執行 OpenAPI 衍生 flow 時，若 step 為 override 型，在呼叫 handler 前於 context 注入 openApiSpecPath、openApiOperationKey（由 resolver 或 createResolveFlow 傳入）。
- **Workspace**：format 不再用硬編碼 API_PARAM_INS 過濾；改為直接使用 flow.params（由產生端已依 paramExpose 過濾）。

## Capabilities

### Modified Capabilities

- **config-openapi**：openapi 每 prefix SHALL 支援可選的 `paramExpose`（預設 path/query/body 暴露、header/cookie 隱藏）；SHALL 支援可選的 `override`（handler 名或模組路徑）；SHALL 移除 `hooks`。生成 flow 時 params 依 paramExpose 過濾；若存在 override，API step 使用 override 為 handler，且 validateRequest 所需資訊 SHALL 透過 context 傳遞（openApiSpecPath、openApiOperationKey）。

## Impact

- **packages/convention-openapi**：移除 hooks 相關程式與型別；新增 paramExpose 過濾與 override 產 step 邏輯；export validateRequest(step, context) 或等同 API；types 與 openApiToFlows 更新。
- **packages/workspace**：resolveFlow/createResolveFlow 在回傳 OpenAPI 衍生 flow 時，若 step 為 override，需能讓執行時 context 帶上 openApiSpecPath、openApiOperationKey（或由 runner 在 run 前注入）；format 改為信賴 flow.params，移除 API_PARAM_INS 硬編碼過濾。
- **apps/cli / apps/mcp-server**：若需在執行前注入 context 的 openApiSpecPath/openApiOperationKey，則在 createResolveFlow 或 run 的 options 中傳遞。
- **openspec/specs/config-openapi**：補充 paramExpose、override、移除 hooks；註明 validateRequest 依 context 傳遞。
- **examples/config/runflow.config.json**：移除 hooks，可選加入 paramExpose 與 override 範例。
