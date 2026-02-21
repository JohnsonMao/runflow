## Context

Runflow 的 built-in http handler（`@runflow/handlers`）目前只使用 step 的 `url`、`method`、`headers`、`body`；template substitution 由 core executor 在呼叫 handler 前套用，handler 收到的是已替換後的 snapshot。本次變更在維持既有行為的前提下，擴充 step 形狀，讓 path、query、cookie 也能在 step 層指定並參與組裝，以支援動態 path/query 與 Cookie 情境。

## Goals / Non-Goals

**Goals:**

- http step 支援可選 `path`、`query`、`cookie`，與 body/header 一樣經 executor 替換後傳入 handler。
- 在 handler 內依 `url` + `path` 組出最終 pathname、依 `query` 組出 search、依 `cookie` 設定 Cookie header，語意明確且可測。
- 未提供 path/query/cookie 時行為與現有一致，無 breaking change。
- config-handlers-openapi 的 step shape 文件與實作一致（built-in 與 custom handler 皆可選用新欄位）。

**Non-Goals:**

- 不改變 executor 的 template 替換時機或規則。
- 不規定 flow YAML 或 OpenAPI 產生的 step 是否「必須」填 path/query/cookie；僅定義有填時的語意。
- 不實作認證或 session 管理，僅提供 cookie 欄位傳遞。

## Decisions

### 1. URL 組裝：path 與 query 的套用順序

- **path**：若 step 有 `path`，以 `path` 作為最終 URL 的 pathname（可含前導 `/` 或否）；若無 `path`，使用 `url` 的 pathname，與今日一致。
- **query**：若 step 有 `query`，依實作格式（見下）產出 search string；與 `url` 既有 query 的合併策略：**以 step.query 為準覆寫**（實作可選合併，但 spec 只要求「可覆寫」）。
- 最終 URL = `url` 的 origin（protocol + host + port） + 上述 pathname + 上述 search。

**Alternatives considered:** path 與 url 做字串合併（例如 url 為 base、path 為 suffix）易產生重複 slash 或語意不清，故採用「path 有則覆寫 pathname」的單一規則。

### 2. query 的格式

- **決策**：支援兩種形式：(1) **Record<string, string>**：鍵值對，由實作 encode 為 application/x-www-form-urlencoded；(2) **string**：已編碼的 query string，直接作為 search（不含前導 `?`）。
- 若為 object，鍵值皆須為 string（或可轉成 string）；陣列或巢狀結構不在此 spec 範圍。

**Alternatives considered:** 僅支援 string 最簡單，但 YAML 裡 key-value 較好寫；故兩者皆支援。

### 3. cookie 的格式與與 headers 的關係

- **決策**：`cookie` 支援 **string**（直接作為 `Cookie` header 值）或 **Record<string, string>**（由實作序列化為 `key1=value1; key2=value2`）。
- 與 `headers` 的關係：若 step 同時提供 `headers['Cookie']` 與 `cookie`，**以 `cookie` 欄位為準**覆寫 `Cookie` header（即 cookie 欄位優先）；若僅有其一則只設一個。實作可選「合併」兩者，但 spec 僅要求 cookie 可覆寫/設定 Cookie header。

**Alternatives considered:** 一律合併可能造成順序或重複 key 不明確，故採用「cookie 欄位優先」的單一規則。

### 4. FlowStep 型別

- **決策**：在 core 的 FlowStep 型別（或 handlers 消費的 step 型別）上新增可選 `path?: string`, `query?: Record<string, string> | string`, `cookie?: Record<string, string> | string`。若 core 目前以 index signature 涵蓋額外欄位，則在型別/文件中明確列出這三個即可，不強制改型別結構。

### 5. Custom handler 相容性

- **決策**：Custom handler（config 中 `handler: "path/to.mjs"`）收到的 step 形狀擴充為含 path/query/cookie；未使用時可忽略，行為與今日一致。不在本 change 強制 custom handler 必須處理新欄位。

## Risks / Trade-offs

- **[Risk] URL 組裝邊界情況**（例如 url 含 path 且 step 又給 path）：以 path 覆寫 pathname 可避免歧義；若 url 本身為完整 URL，path 仍覆寫 pathname，可能造成「base 與 path 語意重疊」。  
  **Mitigation**: 在 spec 與設計中明確寫出「path 有則取代 url 的 pathname」，並在 tests 覆蓋 url+path 組合。

- **[Risk] query/cookie 的 object 鍵值型別**：若 YAML 寫入數字或布林，需轉 string。  
  **Mitigation**: 實作時統一轉 string；spec 註明「string 或可轉成 string」。

- **[Trade-off]** 不支援「合併 url 既有 query 與 step.query」的細部語意，以簡化實作與文件。若未來需要，可在 spec 加選項延伸。

## Migration Plan

- 無部署或資料遷移；僅程式與 spec 變更。
- 現有 flow YAML 與 OpenAPI 產生的 step 不帶 path/query/cookie，行為不變。
- 若有 custom handler 依「僅 4 個欄位」做型別檢查，需更新為接受可選 path/query/cookie（或使用更寬鬆型別）。

## Open Questions

- 無。path/query/cookie 格式與優先順序已在上述決策中定案，可進入 tasks 與實作。
