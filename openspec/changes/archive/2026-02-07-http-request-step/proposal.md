# Proposal: HTTP 請求步驟（含可配置輸出 key 與 allowErrorStatus）

## Why

1. **第一方 HTTP 步驟**：flow 需要以「步驟」形式發送 HTTP 請求，並將結果傳給後續步驟使用。目前僅能透過 command 呼叫 curl 或透過 js 步驟手動發請求，缺乏統一、可宣告的介面。
2. **與現有資料流一致**：輸入來自當前 context（params + 前序步驟 outputs），輸出合併進 context，與 command / js 步驟的資料傳遞模型一致。
3. **可讀性與彈性**：可配置的輸出 key（方案 C）讓多個 HTTP 步驟並存時不互相覆蓋；allowErrorStatus 讓流程在 4xx/5xx 時仍能取得 response body 並由後續步驟決定如何處理。

## What Changes

### 1. 新增 step type：`http`

- 步驟必備欄位：**id**、**type: http**、**url**（字串，必填）。
- 選填欄位：**method**（字串，預設 `GET`）、**headers**（key-value 字串）、**body**（字串）。
- **模板替換**：`url`、`method`、`headers` 各值、`body` 在執行前皆以當前 **context** 做 `{{ key }}` 替換（與現有 substitute 語法一致，支援 dot 與 `[index]`）。

### 2. 輸出寫入 context（方案 C：可配置 output key）

- 選填欄位 **`output`**（outputKey）：指定寫入 context 的 key。執行後將 HTTP 回應寫入該 key。
- **未指定時**：使用步驟的 **id** 作為 key，與現有 js 步驟「以 step id 區分」的慣例一致。
- 寫入值為一物件，建議形狀：**`{ statusCode, headers, body }`**。`body` 依 response 的 Content-Type 決定為字串或已 parse 的 object（例如 application/json → object）；實作細節於 design/spec 定案。

### 3. allowErrorStatus（擴充）

- 選填欄位 **`allowErrorStatus`**（布林，預設 `false`）。
- **false**：僅 2xx 視為成功；非 2xx 或網路錯誤時該步 `success: false`、不寫入 outputs（或僅寫入 error 訊息）。
- **true**：不論 status code，皆將 response（statusCode、headers、body）寫入 context 的 output key；是否同時將該步標記為 `success: false` 由 design 決定（建議：仍標記為 false，但 outputs 照常合併，供後續步驟依 `params.<output>.statusCode` 分支）。

### 4. 與 executor 整合

- Executor 對 `type: http` 的步驟：以當前 context 對 url/method/headers/body 做 substitute → 發送請求 → 依 allowErrorStatus 與 status 決定 success 與是否寫入 outputs → 將 outputs 合併進 context，與 js 步驟相同。

## Capabilities

### New

- **HTTP request step**：flow 支援步驟型別 `http`，具 url（必填）、method、headers、body；所有字串欄位支援模板替換；可配置 `output` 作為寫入 context 的 key；支援 `allowErrorStatus` 以在非 2xx 時仍寫入 response 供後續使用。

### Modified

- **Parser**：接受並驗證 `type: http` 步驟（id、url 必填；method、headers、body、output、allowErrorStatus 選填）。
- **Executor**：新增 http 步驟的執行分支；對 http 步驟的 url/method/headers/body 做 substitute，發送請求，依 allowErrorStatus 與 status 設定 success 與 outputs，並將 outputs 合併進 context。
- **Core types**：新增 `FlowStepHttp`，並納入 `FlowStep` union。

## Impact

- **packages/core**：types（FlowStepHttp）、parser（http 步驟解析）、executor（runHttpStep、substitute 套用至 http 欄位）、HTTP 實作（建議使用 `fetch` 或 node 內建，避免額外依賴）。
- **Specs**：新增 `http-request-step` spec，涵蓋步驟型別、output key、allowErrorStatus 行為與錯誤處理。

## Non-goals（本 change 不涵蓋）

- 不實作重試、timeout 細部設定、request/response 的 schema 驗證。
- 不支援從檔案載入 body（如 bodyFile）；若需複雜 body 可由前一步 js 組好後以 `{{ key }}` 代入。
