# Proposal: Flow 頂層參數宣告、形狀驗證、模板替換與 JS 檔案步驟

## Why

1. **頂層參數宣告與驗證**：目前執行時參數僅能透過 `--param key=value` 傳入，flow 本身無法宣告需要哪些參數、型別、必填或選項值，無法在執行前驗證、也無法主動提醒使用者該 flow 需要哪些參數。
2. **複雜型別與物件形狀**：實務上需要傳入物件或陣列（例如 config、env）；僅字串 key-value 不足。且物件需要能驗證「形狀」（哪些 key、型別為何），避免傳錯結構。
3. **模板替換**：command 步驟的 `run` 目前為字面字串，無法使用 context 中的參數或前步驟輸出。需要替換語法（如 `{{ key }}`），並支援巢狀與陣列取值（dot 與 `[0]`），物件值以 JSON 字串化。
4. **CLI 輸入方式**：除 `--param` 外，需支援從 JSON 檔讀入參數，以方便傳入複雜物件與陣列。
5. **JS 步驟載入檔案**：目前 js 步驟僅支援 inline `run` 字串；需支援以 `file` 指定 .js 檔案路徑並載入執行，路徑相對 flow 檔案，不支援 .ts。

## What Changes

### 1. Flow 頂層參數宣告（params schema）

- 在 flow YAML 頂層支援 **`params`** 陣列，每個元素宣告一個參數：
  - **name**：參數名稱。
  - **type**：`string` | `number` | `boolean` | `object` | `array`。
  - **required**：是否必填（預設可為 `false`）。
  - **default**：選填，預設值。
  - **enum**：選填，允許的值列表（用於驗證與提示）。
  - **description**：選填，供 CLI 提示用。
- **物件形狀**：當 `type: object` 時，可選 **schema**（或 **properties**）描述巢狀形狀，遞迴使用同一套型別語意（每欄可再設 type、required、default、enum）；實作建議以 **Zod** 從此宣告產生 schema 並於執行前驗證。
- **陣列元素型別**：當 `type: array` 時，可選 **items** 描述元素型別（如 `items: { type: string }`），對應 `z.array(z.string())` 等。

### 2. 執行時參數來源與合併

- **CLI**：
  - 沿用 **`--param key=value`**（多個合併，後覆蓋前）。
  - 新增 **`--params-file <path>`**（或 `-f`）：從 JSON 檔讀入單一物件，與 `--param` 合併後作為 `params`；合併順序建議：先載入 params-file，再套用 --param。
- **Core**：`run(flow, options)` 的 `options.params` 可為巢狀結構（`Record<string, unknown>`），不再限於字串。執行前依 flow 頂層 `params` 宣告（經 Zod）驗證；驗證失敗則回傳明確錯誤（缺必填、型別錯誤、不在 enum 內）。

### 3. 模板替換語法

- **適用範圍**：至少適用於 **command** 步驟的 **`run`** 欄位；是否擴及其他步驟或欄位於 design 決定。
- **語法**：
  - **根層**：`{{ key }}` → context 的 `key`。
  - **Dot 語法**：`{{ key.nested }}`、`{{ config.debug }}`。
  - **中括號語法**：`{{ tags[0] }}`、`{{ items[2] }}`；可與 dot 混用，如 `{{ config.levels[0] }}`。
- **取值規則**：依序解析 `.` 與 `[數字]`；若中途為 `undefined` 或 `null`，替換結果為空字串（或明訂字面值，於 design 定案）。
- **物件/陣列值**：若最終值為物件或陣列，以 **JSON.stringify(value)** 代入；字串/數字/布林直接轉字串。

### 4. 主動提醒與驗證

- 執行前依頂層 `params` 宣告驗證 `options.params`；失敗時錯誤訊息可指出：缺少必填、型別不符、不在 enum。
- CLI 可提供「列出此 flow 所需參數」的能力（例如 `flow params flow.yaml` 或於 `flow run` 缺參時提示），顯示必填、型別、enum，方便使用者知道該傳什麼。

### 5. JS 步驟支援 file

- **type: js** 步驟除現有 **run**（inline 字串）外，支援選用 **file**：指向一 `.js` 檔案路徑。
- **二擇一**：有 `file` 時以檔案內容執行，無 `file` 時以 `run` 為程式碼；若兩者皆有或皆無，解析規則於 design/spec 明訂。
- **路徑解析**：相對 **flow 檔案所在目錄**。
- **不支援 .ts**：僅支援 `.js` 檔案。

## Capabilities

### New

- **Flow 頂層 params 宣告**：YAML 可宣告參數名稱、型別、必填、預設、enum、物件 schema、陣列 items。
- **參數驗證（Zod）**：執行前以宣告產生 Zod schema 驗證傳入 params，並可支援 CLI 提示。
- **CLI --params-file**：從 JSON 檔讀入參數，支援複雜物件與陣列。
- **模板替換**：command 的 run 支援 `{{ key }}`、dot、`[index]`，物件值 JSON 字串化。
- **JS step file**：js 步驟可透過 `file` 指定 .js 檔案並載入執行。

### Modified

- **Parser**：解析頂層 `params` 與各參數的 type/required/default/enum/schema/items。
- **Executor**：執行前驗證 params；執行 command 前對 run 字串做模板替換（使用當前 context）。
- **Core types**：`RunOptions.params` 擴充為 `Record<string, unknown>`；FlowDefinition 新增 params 宣告型別。
- **CLI**：支援 `--params-file`；可選提供 params 列出/提示。

## Impact

- **packages/core**：types（FlowDefinition.params、RunOptions）、parser（params 與 schema）、executor（驗證 + 替換 + js file 載入）、可能新增依賴 zod。
- **apps/cli**：--params-file、參數合併順序、可選 params 提示。
- **Specs**：新增或擴充 spec（例如 flow-params-schema、template-substitution、js-step-file），與現有 exec-params、step-context、js-step-type 的關係於 design 釐清。

## Non-goals（本 change 不涵蓋）

- 不支援 TypeScript（.ts）檔案執行。
- 模板替換是否擴及 js 步驟的 run 或其它欄位，留待 design/spec 決定。
