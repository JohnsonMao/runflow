# Design: Flow 頂層參數宣告、形狀驗證、模板替換與 JS 檔案步驟

## Context

- **現有**：exec-params 已支援 `--param key=value` 與 `RunOptions.params`（目前型別為 `Record<string, string>`）；step-context 已支援 context 累積與 js 步驟讀寫 params/outputs；js-step-type 已支援 inline `run`。
- **本 change**：擴充為頂層 params 宣告與 Zod 驗證、CLI --params-file、模板替換（command run）、js 步驟 file 載入；RunOptions.params 改為 `Record<string, unknown>`。

## Goals / Non-Goals

**Goals:**

- Flow YAML 可宣告 params（name, type, required, default, enum, schema, items）；執行前以 Zod 驗證。
- CLI 支援 --params-file 讀取 JSON，與 --param 合併（file 先、param 後）。
- Command 步驟的 run 支援 `{{ key }}`、dot、`[index]`，物件/陣列 JSON.stringify，undefined/null→""。
- JS 步驟可選 `file` 指向 .js，路徑相對 flow 檔案目錄；僅 .js。

**Non-Goals:**

- 不支援 .ts 執行；不擴展模板替換到 js 的 run 或其他欄位（本階段僅 command run）。

## Decisions

### Decision 1: Params declaration → Zod schema

- **YAML 結構**：頂層 `params` 為陣列，每項 `name`, `type`, `required?`, `default?`, `enum?`, `description?`；`type: object` 時可帶 `schema`（key 為 property name，value 為同結構）；`type: array` 時可帶 `items: { type, ... }`。
- **轉換**：實作時寫一函式 `paramsDeclarationToZodSchema(declaration): z.ZodType`，遞迴建 `z.object` / `z.array` / `z.string` / `z.number` / `z.boolean`，並處理 required、default、enum。object 的 schema 中未列出的 key 可訂為 strip（不允許多餘）或 passthrough；建議 strip 以利形狀嚴格。
- **驗證時機**：在 `run(flow, options)` 開頭，若 `flow.params` 存在則 `schema.safeParse(options.params)`；失敗則 throw 或回傳 RunResult 含 error，不執行任何步驟。錯誤訊息使用 Zod 的 path + message，必要時轉成「缺必填 / 型別錯誤 / 不在 enum」的說明。

### Decision 2: RunOptions.params type and backward compatibility

- **型別**：`RunOptions.params` 改為 `Record<string, unknown>`，以支援巢狀物件與陣列。
- **相容**：當 flow 無 `params` 宣告時，現有 CLI 仍傳 `Record<string, string>`（--param 僅字串）；core 不做 schema 驗證，直接當 initial context。有 params 宣告時，傳入值須通過 Zod，通過後 context 即為驗證後的物件（可含巢狀）。

### Decision 3: CLI --params-file and merge order

- **選項**：`--params-file <path>` 與短選項 `-f <path>`。讀檔：`fs.readFileSync(path, 'utf-8')`，`JSON.parse`；若結果非 object 或檔不存在/非 JSON，CLI 列印錯誤並 process.exit(1)。
- **合併**：`params = { ...paramsFromFile, ...paramsFromCli }`。即先載入 file（無 file 則 `{}`），再將每個 `--param key=value` 寫入；同一 key 時 --param 覆蓋 file。--param 的值目前仍為字串；若 flow 有 params schema，Zod 可嘗試 coerce（例如 number 型則 Number(value)），或規定 --param 僅補字串、複雜型只從 file 來，由實作選一並在文件中說明。

### Decision 4: Template substitution implementation

- **適用**：僅 command 步驟的 `run` 欄位。
- **語法**：`{{ expression }}`，expression 為一 path：識別子、`.identifier`、`[number]` 的組合，例如 `a`、`a.b`、`a[0]`、`a.b[1].c`。正則或小型 parser 解析 expression，再依序從 context 取值：遇 `.x` 取 property，遇 `[n]` 取 index。
- **取值**：若中途為 undefined 或 null，該 placeholder 替換為 `""`。最終值為 object 或 array 則 `JSON.stringify(value)`（無美化）；否則 `String(value)`。
- **執行順序**：每步執行前，用當前 context 對該步的 run 字串做一次全域替換（所有 `{{ ... }}`），再將結果傳給 shell。

### Decision 5: JS step file vs run

- **二擇一**：有 `file` 時忽略 `run`（file 優先）；無 `file` 時必須有 `run`（否則 parser 可視為 invalid）。即 `file` 選用，`run` 在無 file 時必填。
- **路徑**：需要「flow 檔案所在目錄」。目前 loader 多數只回傳 flow 內容或 parse 後的 flow，不帶路徑；需在 loader 或 CLI 層保留 flow file path，傳入 executor 或至少傳入「resolve step file 的模組」。實作可：loader 改為回傳 `{ flow, flowFilePath }`，或 CLI 在呼叫 run 前先 resolve 所有 js file 路徑並把內容注入 step（即預先載入成 run）。後者可避免 core 依賴 path；前者較乾淨、core 需能 resolve 相對路徑。建議：core 的 run(flow, options) 擴充 `options.flowFilePath?: string`；若有，執行 js file 步驟時用 `path.resolve(path.dirname(options.flowFilePath), step.file)` 讀檔。
- **僅 .js**：若 `file` 以 `.ts` 結尾或 MIME/內容判斷為 TS，直接報錯（parser 或 executor 皆可）。

### Decision 6: Parser changes

- **頂層 params**：parse 時讀取 `params` 陣列；每項驗證 name（string）、type（string，須為允許的 type）；schema/items 遞迴解析。無 params 或 params 為空陣列皆合法。
- **Step**：js 步驟可選 `file`（string）；若有 file 可允許 run 省略；若無 file 則 run 必填。Invalid：type 為 js 但既無 file 也無 run，或 file 非字串。

### Decision 7: Relation to existing specs

- **exec-params**：仍保留 --param key=value 與 run(flow, { params })；本 change 擴充 params 型別與來源（--params-file），並在有 flow params 宣告時加入驗證。主 spec 可同步更新「params 可為 Record<string, unknown>」「CLI 可從檔案讀入」。
- **step-context**：不變；context 仍為初始 params + 步驟 outputs，僅初始 params 可能來自驗證後的巢狀結構。
- **js-step-type**：擴充為允許 `file` 欄位；主 spec 增加「可選 file，路徑相對 flow 檔案」與「僅 .js」。
- **flow-params-schema、cli-params-file、template-substitution、js-step-file**：為本 change 新增的 delta specs；完成後可 sync 到主 specs（或合併進既有 spec 名稱空間）。

## Implementation notes

- **Zod**：加入 `zod` 為 core 的 dependency；params 驗證與（可選）CLI 列出參數皆用同一份 schema。
- **Template**：可抽成 `substitute(template: string, context: Record<string, unknown>): string`，單元測試覆蓋 dot、bracket、undefined、JSON.stringify。
- **Flow file path**：CLI 在 load flow 時已知檔案路徑；呼叫 `run(flow, { params, flowFilePath: absolutePath })` 即可。Core loader 若單獨使用且無路徑，則 flowFilePath 為 undefined，js file 步驟若有相對路徑則需失敗或改為相對 cwd（建議相對 flow 目錄才支援 file，故無 flowFilePath 時有 file 的步驟應報錯）。
