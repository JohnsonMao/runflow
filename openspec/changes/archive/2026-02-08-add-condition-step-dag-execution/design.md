# Design: Condition Step and DAG Execution Model

## Context

Runflow 目前執行模型為線性：`run()` 依 `flow.steps` 陣列順序逐一執行，context 依序累積。Step 類型透過 registry 分派，已有 command、js、http；無 step 間依賴或條件分支。本 change 引入 DAG 執行與 condition step，需改動 core 的 executor、types、parser，以及 flow schema。

**約束**：維持 StepHandler / StepResult / StepContext 介面；現有 handler 不因 DAG 而改簽名；CLI 仍呼叫 `run(flow, options)`。

## Goals / Non-Goals

**Goals:**

- 執行順序由 step 的 `dependsOn` 決定；無 `dependsOn` 的 step 不執行（孤節點）。
- 依賴關係無環；拓撲排序後可並行執行已滿足依賴的 steps。
- 新增 `type: condition`，評估 `when` 並將結果寫入 context（如 `outputs.result`）；可選 `then`/`else` 語意與 DAG 整合方式在下方決策中說明。
- RunResult 僅包含「有被執行的」steps，順序為執行（或完成）順序。

**Non-Goals:**

- 本階段不實作「可視化 DAG 編輯器」或 CLI 圖形輸出；僅定義 YAML 與執行語意。
- 不改變 params 驗證、template substitution、或既有 step 類型行為。
- 不實作「動態 DAG」（執行中才決定下一跳的圖結構）；condition 的 then/else 若採用「靜態 DAG + 條件輸出」即可滿足需求則優先。

## 執行模型：觸發點、condition 之後、then/else 差異

### 如何知道「觸發點」（入口）

- **觸發點 = 根節點**：任何 `dependsOn: []`（空陣列）的 step 都是「入口」，會在**第一波**被排程執行。
- **辨識方式**：在 YAML 裡看到 `dependsOn: []` 就代表該 step 是入口；若沒有任何 step 有 `dependsOn: []`，且所有 step 都有非空 `dependsOn`，則沒有根節點，DAG 會無法啟動（或驗證時報錯，依實作決定）。
- 多個入口會在同一波並行執行（若開啟並行）。

```
  ┌─────────────────┐
  │ step (dependsOn: [])  │  ← 觸發點（根節點），第一波執行
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ next (dependsOn: [step]) │  ← 依賴 step，step 完成後才排程
  └─────────────────┘
```

### Condition 之後，下一個節點如何執行

- **純 DAG 規則**：任何 step 只要其 `dependsOn` 裡列出的 step 都**已執行完成**，該 step 就會在下一波被排程。
- **Condition 只是其中一種 step**：condition step 跑完後會產出 `outputs.result`（true/false）並 merge 進 context。所有在 YAML 裡寫了 `dependsOn: [<condition_step_id>]` 的 step，在該 condition 完成後就**滿足依賴**，會被排程執行。
- **誰會跑**：凡是有 `dependsOn: [conditionStepId]` 的 step 都會在 condition 完成後被排程；引擎**不**會區分「這是 then 分支還是 else 分支」——那是語意標註（見下一小節）。

```
  ┌──────────────┐
  │ entry        │  dependsOn: []
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ check        │  type: condition, when: "{{ env }} === 'prod'"
  │              │  then: onTrue, else: onFalse
  └──────┬───────┘
         │  result 不寫入 context，僅供引擎排程用
         │  result === true  → 只排程 then 的 step（onTrue）
         │  result === false → 只排程 else 的 step（onFalse）
    ┌────┴────┐
    ▼         ▼
  onTrue    onFalse   onTrue 的 dependsOn: [check]，且列在 then
  (then)    (else)    onFalse 的 dependsOn: [check]，且列在 else
                      → 引擎依 result 只排程其一，不污染 context
```

### if / then / else 三者關係

- **if**：就是「條件 step」本身（一個 step，`type: condition`，有 `when`）。沒有單獨的 "if" 欄位；條件節點的 **id** 就是我們稱的「這個 if」。
- **then**：一個或多個 **step id**；當 `when` 評估為 **true** 時，**只有**這些 id 對應的 step（且其 `dependsOn` 含此 condition step）會被排程。
- **else**：一個或多個 **step id**；當 `when` 評估為 **false** 時，**只有**這些 id 對應的 step（且其 `dependsOn` 含此 condition step）會被排程。

關係式：**if（condition step）→ 評估 when → 若 true 執行 then 的 id，若 false 執行 else 的 id**。dependsOn 用來建圖（then/else 的 step 必須寫 `dependsOn: [<condition_step_id>]` 才會在圖裡）；引擎用 result 決定排程 then 還是 else，**不把 result 寫入 context**，避免污染。

### then / else 與 dependsOn 如何決定「執行 if 還是 else」

- **建圖**：then 與 else 裡列出的 step 都必須在 YAML 裡有 `dependsOn: [<condition_step_id>]`，才會被納入 DAG（否則為孤節點或依賴錯誤）。
- **排程**：condition step 跑完後，引擎只看 result（true/false），**只排程 then 或只排程 else** 對應的 step，不排程另一邊；且 **不將 result 合併進 context**，後續 step 的 context 不會多出 `result`。

## Decisions

### 1. DAG 建圖與孤節點

- **決策**：僅將「至少有一個 `dependsOn` 的 step」納入執行圖；完全沒有 `dependsOn` 的 step 不加入圖、不執行、不出現在 RunResult。
- **理由**：提案已明確不沿用陣列順序，孤節點語意單一、實作簡單。
- **實作要點**：建圖時只加入 `step.dependsOn` 存在且非空陣列的 step；其餘跳過。若需「入口」step，作者可寫一個 `dependsOn: []` 的 step（空陣列視為「無依賴、可先跑」）；與「無欄位」區分：無欄位 = 孤節點，`dependsOn: []` = 根節點。
- **替代**：曾考慮「無 dependsOn 時隱含依賴前一步」；已否決，因與「孤節點」決策一致。

### 2. dependsOn 語意：空陣列 vs 省略

- **決策**：`dependsOn` 省略 = 孤節點（不執行）。`dependsOn: []` = 根節點，無依賴，可作為第一批執行。
- **理由**：允許明確表達「入口」step，且與「無欄位即不執行」一致。
- **實作**：parser/types 中 `dependsOn?: string[]`；executor 建圖時 `if (step.dependsOn == null) → 跳過`；`if (Array.isArray(step.dependsOn) && step.dependsOn.length === 0)` → 加入圖且無入邊。

### 3. 拓撲排序與循環檢測

- **決策**：執行前先以 `dependsOn` 建圖（僅納入有 dependsOn 的 step），做一次拓撲排序；若存在環則不執行，回傳錯誤（invalid flow / cycle detected）。
- **理由**：DAG 必須無環；一次檢測避免執行中卡住。
- **實作**：在 core 內實作或使用輕量 topsort；依賴的 step id 必須存在於「納入圖的 step 集合」內，否則視為 invalid（缺少依賴或依賴到孤節點）。

### 4. 並行執行策略

- **決策**：同一「波次」中，所有依賴已滿足的 steps 以 `Promise.all` 並行執行；完成後將各 StepResult 的 outputs 依序 merge 進 context，再計算下一波次。
- **理由**：符合 DAG 語意、利於效能；context merge 順序在並行下需定義（例如按 step id 字典序或按完成順序）。
- **替代**：第一版可先做「拓撲序後嚴格依序執行」以簡化 context 與除錯，再在後續迭代開啟並行；design 建議可標註「Phase 1 可選序執行，Phase 2 並行」。

### 5. Condition step 的 when 評估與「不污染 context」

- **決策**：`when` 為字串時，視為「可替換模板 + 簡易運算式」。先做 template substitution，再以安全方式求值為 boolean。Condition handler 回傳的 StepResult 含 `nextSteps`（要排程的 step id 陣列，依 result 取自 then 或 else），**不回傳 outputs**，故 executor 不會將 condition 的結果合併進 context；排程僅依 nextSteps，context 保持乾淨。
- **理由**：分支由「then/else 各一個（或多個）step id + 引擎依 result 只排程一邊」決定即可，後續 step 不需要讀 `params.result`；context 保持乾淨。

### 6. Condition 的 then/else 決定排程（if → then id / else id）

- **決策**：Condition step 必須可選填 `then` 與 `else`，各為一個 step id（或 step id 陣列）。引擎行為：
  - Condition 跑完後得到 result（true/false）。
  - **result === true**：只將 `then` 所列的 step id（且該 step 的 dependsOn 含此 condition step）加入下一波可執行集合；`else` 所列的 step **不**排程。
  - **result === false**：只將 `else` 所列的 step id（且 dependsOn 含此 condition step）加入可執行集合；`then` 所列的 step **不**排程。
- **dependsOn 的角色**：then/else 的 step 仍須在 YAML 裡寫 `dependsOn: [<condition_step_id>]`，才會在 DAG 圖內；引擎用 result 決定「這一波只排程 then 還是 else」，因此自然達成「只執行 if 的 then 或 else 一邊」，無需把 result 寫入 context。
- **if / then / else 關係**：if = 該 condition step（一個 id）；then = 一個或多個 step id（true 時跑）；else = 一個或多個 step id（false 時跑）。

### 7. 型別與 Schema

- **決策**：`FlowStep` 擴充為 `dependsOn?: string[]`（可選）。Condition step 使用 `when: string`（必要），`then?`/`else?` 可為 `string | string[]`（step id(s)），語意以 spec 與本 design 為準。flow.schema.json 與 generate-flow-schema 腳本需更新以反映 `dependsOn` 與 condition 欄位。
- **理由**：向後不相容；既有 YAML 無 dependsOn 的 step 會變成孤節點，需在遷移說明中寫清。

### 8. Dry-run 與 RunResult 順序

- **決策**：dry-run 時仍建 DAG、做拓撲排序與循環檢測，可選擇性輸出「將執行的 step 順序」或僅驗證；不執行 handler。RunResult.steps 順序為「執行順序」（或完成順序），與 YAML 中 steps 陣列順序無關。
- **理由**：與 DAG 語意一致；除錯與工具可依執行順序解讀。

## Risks / Trade-offs

- **[Risk] 既有 flow 全部 break** → Migration：文件明確說明「每個需執行的 step 必須有 dependsOn」；提供遷移範例（線性鏈：step2 dependsOn [step1], step3 dependsOn [step2]）。
- **[Risk] when 運算式過強導致安全問題** → Mitigation：使用受限 evaluator（僅讀 context、無 I/O、無 require），或限定為簡單比較/邏輯運算。
- **[Risk] 並行下 context merge 順序非直覺** → Mitigation：明確定義（例如按 step id 排序後 merge），並在文件中說明；或 Phase 1 不做並行。
- **[Trade-off] condition 的 result 不寫入 context** → 分支完全由 then/else 排程決定；若未來有 step 需要讀「上一個 condition 的結果」可再考慮可選寫入或專用欄位。

## Migration Plan

1. **發布前**：在 README / 遷移指南中說明 DAG 與孤節點規則；提供「線性 flow 遷移」範例（每個 step 依賴前一個）。
2. **實作**：在 core 加入 DAG 建圖、拓撲排序、循環檢測；executor 改為依 DAG 波次執行；新增 condition handler 並註冊；parser 與 types 支援 dependsOn 與 condition。
3. **測試**：現有測試若假設線性順序，需改為在 flow 中加上 dependsOn；新增 DAG、孤節點、condition、循環檢測的單元與整合測試。
4. **Rollback**：若需回退，還原 executor 與 parser 至線性版本；已使用 dependsOn 的 flow 需一併還原或標記不支援。

## Open Questions

- Condition `when` 的具體語法與 evaluator 選型（內建簡易 parser vs 使用 vm 模組 vs 第三方 safe-eval）待實作時定案。
- RunResult.steps 在並行時採用「完成順序」還是「拓撲序」輸出，可依除錯需求在實作時決定並寫入 spec 補充。
- 是否在 Phase 1 關閉並行（嚴格依拓撲序依序執行）以簡化 context 與除錯，可於 tasks 階段決定。
