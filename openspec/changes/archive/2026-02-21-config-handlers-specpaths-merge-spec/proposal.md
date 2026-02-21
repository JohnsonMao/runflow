# Proposal: config handlers specPaths + merge spec

## Why

Handlers 目前一個 OpenAPI entry 只對應單一 `specPath`，無法把多個 spec 合併成一個來源。改為 **specPaths（陣列）** 可讓一個 entry 對應多個 spec，載入時合併成一個大 OpenAPI 再產 flow，step type 維持為 entry key，語意更一致且擴充性更好。同時簡化 runner 與 handler 的契約：只傳遞 **flow**，移除 openApiContext、flowFilePath 等欄位，並將 workspace 的 config / resolve / load 收整為單一模組，減少檔案邊界造成的混亂。

## What Changes

- **Handlers OpenAPI entry**：由單一 `specPath` 改為 **specPaths**（字串陣列）。載入時將每個 spec 讀成 JSON，合併成一個 OpenAPI 文件後對合併結果做 `openApiToFlows`；step type 為該 entry 的 key（如 `scm`），一個 handler、一個 step type。
- **resolveFlowId**：支援 specPaths；ResolvedFlow 的 openapi 型別改為帶合併後所需資訊（例如 specPaths 或合併後的 in-memory spec 來源），不再暴露單一 specPath / openApiSpecPath / openApiOperationKey 給上層。
- **LoadedFlow**：**BREAKING** 移除 `openApiContext`（含 openApiSpecPath、openApiOperationKey）。**BREAKING** 移除 `flowFilePath`。只保留 **flow**；runner 與 override handler 不再收到 specPath、path、openApiSpecPath、openApiOperationKey。
- **Flow 作業範圍**：不再依 flowFilePath 限制讀取範圍；flow 的範圍僅由 config 的 **flowsDir** 決定（file-type flowId 一律在 flowsDir 內解析）。
- **packages/workspace**：將 `loadFlow.ts`、`resolveFlow.ts`、`config.ts` 收整為單一檔案或更清晰的模組邊界，避免三個檔案職責分散、意義不明。

## Capabilities

### New Capabilities

（無；本 change 僅修改既有 capability 需求。）

### Modified Capabilities

- **config-openapi**：handlers 內 OpenAPI 來源改為 specPaths（陣列）；flowId 仍為 `key-operationKey`，但解析時改為「多 spec 合併後再取 operation」。
- **config-handlers-openapi**：OpenApiHandlerEntry 改為 **specPaths**（必填，字串陣列）取代 specPath；載入與合併語意、step type = key、registry 建構更新。
- **workspace**：resolveFlowId 支援 specPaths 並回傳對應的 ResolvedFlow；ResolvedFlow / LoadedFlow 不再含 openApiSpecPath、openApiOperationKey、specPath、path、flowFilePath；createResolveFlow / resolveAndLoadFlow 回傳僅含 **flow**；discover 與 list/detail 依新 ResolvedFlow 與合併 spec 邏輯；config、resolve、load 收整至單一模組（或明確分工的少數檔案）。

## Impact

- **packages/workspace**：config 型別（OpenApiHandlerEntry.specPaths）、resolveFlowId、loadFlow / createResolveFlow / resolveAndLoadFlow、LoadedFlow 型別與實作；合併多 spec 的邏輯（可在此或 convention-openapi）；檔案合併（config.ts + resolveFlow.ts + loadFlow.ts 收整）。
- **packages/convention-openapi**：若合併 OpenAPI 邏輯放在此處，需提供「多 spec 合併成單一 OpenAPI」的函式或選項；openApiToFlows 可能改為接受合併後的 spec 物件或檔案路徑。
- **apps/cli**、**apps/mcp-server**：消費 LoadedFlow 時只使用 `flow`，移除對 openApiContext、flowFilePath、specPath、path 的依賴。
- **apps/flow-viewer**（workspace-api）：若有使用 resolveFlowId / discover / LoadedFlow，需改為新契約與 flowsDir 範圍。
- **examples**：runflow.config.json 等範例改為使用 specPaths（陣列）取代 specPath。
