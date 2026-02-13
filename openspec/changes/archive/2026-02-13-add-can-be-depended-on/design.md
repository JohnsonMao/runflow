# Design: 允許依賴驗證（getAllowedDependentIds）

## Context

Runflow 的 condition 與 loop step 以 nextSteps / completedStepIds 控制排程；then/else、entry/done 的 step 目前都寫 `dependsOn: [designator]`。為避免非指定 step 誤依賴 designator，在執行前加入「誰可以依賴此 step」的驗證，由 handler 可選方法 `getAllowedDependentIds(step)` 提供允許的 dependents。

**約束**：不改變 getRunnable、nextSteps、completedStepIds 邏輯；既有 flow YAML 無須修改。

## Goals / Non-Goals

**Goals:**

- IStepHandler 新增可選 `getAllowedDependentIds?: (step) => string[]`。當 handler 實作此方法時，僅允許回傳的 step id 出現在其他 step 的 dependsOn 裡指向該 step；違規時報錯並列出違規 step id。
- condition、loop handler 實作 `getAllowedDependentIds`（condition: then+else；loop: entry+done，可含 end）。
- 執行前（或 dry-run 前）驗證；錯誤訊息可被 CLI / MCP 直接顯示，便於除錯。

**Non-Goals:**

- 不引入 designated 排程路徑（不改變 getRunnable）。
- 不要求 then/else、entry/done 的 step 移除 dependsOn: [designator]。

## 驗證時機與位置

- **時機**：在 `run(flow, options)` 內，於 DAG 驗證（拓撲、cycle）之後、第一波 step 執行之前執行允許依賴驗證。
- **位置**：在 `@runflow/core` 的 executor 內呼叫 `validateCanBeDependedOn(flow, stepByIdMap, registry)`。可被 dry-run 或 CLI 重複使用。
- **dry-run**：與正式 run 相同，先做 DAG 驗證再做允許依賴驗證，通過後才回傳「不執行」的結果。

## 允許的 dependents 推導

- **condition**：`allowedIds = normalizeStepIds(step.then) + normalizeStepIds(step.else)`。使用與 condition handler 相同的 normalize（例如 core 的 `normalizeStepIds`）。
- **loop**：`allowedIds = normalizeStepIds(step.entry) + normalizeStepIds(step.done)`；若有 `step.end` 可一併納入，與現有 loop 欄位一致。
- 凡 `dependsOn` 包含此 step id 的 step，其 id 必須在對應的 allowedIds 內，否則列為違規。
- **訊號**：僅當 handler 實作 `getAllowedDependentIds` 時才對該 step 做上述驗證；未實作則不限制（任何 step 皆可依賴）。

## 錯誤訊息格式

- 至少包含：哪個 step（designator id）不允許被依賴、以及違規的 step id 列表（例如 `step "cond" allows only dependents [thenStep, elseStep]; step "other" has dependsOn: [cond]`）。
- 回傳方式與現有 DAG 錯誤一致：`RunResult { success: false, error: string, steps: [] }` 或 executor 內 throw；由 core 約定即可。

## Handler 實作

- **condition**：在 `ConditionHandler` 實作 `getAllowedDependentIds(step)`，回傳 then + else 的 id。
- **loop**：在 `LoopHandler` 實作 `getAllowedDependentIds(step)`，回傳 entry + done（+ end）的 id。
- **其餘 handler**：不實作 `getAllowedDependentIds`，引擎不限制誰可依賴該 step。

## 架構規範（Core 不依賴 Handler 型別）

- **Core 不得依 step.type 做 handler 專屬邏輯**：`packages/core` 內不可依 `step.type === 'condition'`、`step.type === 'loop'` 等分支解讀 step 形狀。擴充新 step 型別時，core 不應為此改程式。
- **由 Handler 提供行為**：需要與引擎整合時，由 handler 實作可選介面方法 `getAllowedDependentIds(step)`。Core 只呼叫 `registry[step.type].getAllowedDependentIds(step)`，不解析 step 的 then/else、entry/done 等欄位。
- **實作時**：在 core 新增任何「依 step 形狀決定行為」的邏輯前，先問：是否應改為由 handler 提供 optional method，由 core 呼叫？

## 型別與介面

- **IStepHandler**（types.ts）：可選 `getAllowedDependentIds?: (step: FlowStep) => string[]`。當此方法存在時，引擎呼叫它取得允許依賴此 step 的 id 列表，並驗證僅這些 id 可出現在 dependsOn 中；core 不解析 step 內容。
- **StepRegistry** 不變；registry 的 value 仍為 IStepHandler。

## 測試要點

- 通過：condition 的 then/else step 依賴 condition、loop 的 entry/done step 依賴 loop，驗證通過。
- 失敗：任一非 then/else、非 entry/done 的 step 的 dependsOn 包含 condition 或 loop，驗證失敗且錯誤含違規 step id。
- 未實作 getAllowedDependentIds 的 handler（如 set、http）：不影響，驗證通過。
- dry-run：同樣執行驗證，失敗時回傳錯誤不執行。
