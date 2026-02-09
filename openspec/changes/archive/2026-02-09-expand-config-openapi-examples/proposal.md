# Proposal: Expand Config (OpenAPI) & Converge Examples

## Why

Config 目前缺乏 OpenAPI 相關設定，不利於 convention-openapi 與 CLI 整合；同時 examples 數量多且重疊，不利於新手上手與維護。此變更擴充設定檔以支援 OpenAPI 配置，並將 examples 收斂為少數具代表性的範例。

## What Changes

- **Config 擴充**：在 runflow 設定檔（如 `runflow.config.mjs` / 未來 YAML config）中新增 OpenAPI 相關配置項（例如 spec 路徑、是否產生 flow、輸出目錄等），供 CLI 與 convention-openapi 使用；並新增 `allowedCommands`（command 步驟允許的可執行檔名稱清單），供 CLI 傳入 engine 以限制可執行的 shell 指令，預設為最小安全清單，空陣列表示不允許任何 command。
- **Examples 收斂**：精簡 `examples/` 目錄，保留少數有代表性的範例（涵蓋：基本 flow、參數/ schema、DAG、HTTP、JS step、自訂 handler 等），其餘移除或合併，並確保 README/文件指向現有範例。
- 若有破壞性變更（例如 config 欄位重新命名或移除舊 example 檔案），將在設計階段標註 **BREAKING** 並在 Impact 中說明遷移方式。

## Capabilities

### New Capabilities

- `config-openapi`: 定義 runflow config 中與 OpenAPI 相關的設定結構與行為（例如 `openapi.specPath`、`openapi.outDir`、選項與預設值），以及 CLI 如何讀取並傳遞給 convention-openapi。
- `config-allowed-commands`: 定義 config 的 `allowedCommands` 陣列與 engine/command handler 行為（預設安全清單、空陣列=不允許、CLI 傳入 run 選項）。
- `examples-converge`: 定義 examples 的收斂策略、保留清單（具代表性的幾類範例）、目錄結構與命名，以及與文件/README 的對應關係。

### Modified Capabilities

- （無：現有 `openspec/specs/` 中無 config 專用 spec；`convention-to-flow` 若僅消費新 config 而不改變既有對外行為，可不列於此。）

## Impact

- **受影響程式**：`apps/cli`（讀取 config、傳遞 openapi 選項）、`packages/convention-openapi`（若需依 config 驅動行為）、專案根或 `examples/` 下的設定與範例檔。
- **依賴**：無新增外部依賴；依賴現有 convention-openapi 與 CLI 的 config 載入方式。
- **文件**：README、examples 內說明或 openspec 文件需同步更新以反映新 config 欄位與收斂後的範例清單。
