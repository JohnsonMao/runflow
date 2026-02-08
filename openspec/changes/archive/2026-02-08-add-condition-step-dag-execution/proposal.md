# Proposal: Condition Step and DAG Execution Model

## Why

目前 flow 是純線性執行（steps 陣列依序跑），無法表達條件分支、依賴關係或並行，也難以用圖形化方式梳理執行順序。引入 **DAG 執行模型** 與 **condition 類型 step**，可讓流程以有向圖定義「誰依賴誰、誰可並行」，並用條件 step 決定分支走向，方便以圖形化方式理解與設計流程；breaking 變更可接受。

## What Changes

- **執行模型改為 DAG**：steps 不再隱含「陣列順序 = 執行順序」。每個 step 可聲明 `dependsOn: [stepId, ...]`，引擎依賴關係拓撲排序後執行；無依賴或依賴已完成的 step 可並行執行。**無 `dependsOn` 的 step 視為孤節點**，不沿用陣列順序、不納入執行圖，該 step 不會被執行。**BREAKING**：現有 flow 須為每個要執行的 step 顯式加上 `dependsOn`，否則該 step 為孤節點。
- **新增 condition step 類型**：`type: condition` 的 step 提供條件判斷（例如 `when` 運算式或 `if/elseThen` 對應的下一步），結果決定後續哪些 step 會被「啟用」或作為下一跳；與 DAG 結合可表達分支與匯流。
- **YAML / Schema**：flow 定義擴充為支援 step 的 `dependsOn` 與 condition 的專用欄位；JSON Schema 與 parser 需一併更新。
- **CLI / 輸出**：執行結果仍為線性 step 結果列表，但順序可能與定義順序不同（依 DAG 執行順序）；必要時可增加「執行順序」或 DAG 視覺化相關選項（屬後續可選）。

## Capabilities

### New Capabilities

- `dag-execution`: 定義並執行以 DAG 為模型的 flow；含 step 的 `dependsOn`、拓撲排序、可並行執行；無 `dependsOn` 的 step 為孤節點、不執行。
- `condition-step`: condition 類型 step 的語意、YAML 欄位（如 `when`、`then`/`else` 對應的 step id）、與 DAG 的整合（條件結果決定後續依賴或啟用步驟）。

### Modified Capabilities

- （若設計階段決定現有 spec 的「需求」有變更，再於 design 後補 delta spec；例如 `step-context` 若 condition 需擴充 context 傳遞。）

## Impact

- **@runflow/core**：executor 改為依 DAG 排序/排程執行（含並行）；新增 condition handler；parser 與 types 支援 `dependsOn` 與 condition step 結構；substitute 與 context 仍適用於 condition 運算式。
- **Flow YAML / flow.schema.json**：steps 可含 `dependsOn`；condition step 的專用欄位；schema 生成腳本需更新。
- **@runflow/cli**：現有 `run` 行為改為 DAG 執行結果；必要時新增輸出選項（例如執行順序或 dry-run 時顯示 DAG）。
- **既有 flow 檔案**：每個 step 皆須有 `dependsOn` 才會被執行；無 `dependsOn` 的 step 為孤節點，不執行。既有 flow 須遷移補上依賴關係。
