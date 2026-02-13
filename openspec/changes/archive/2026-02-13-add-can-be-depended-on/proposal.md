# Proposal: canBeDependedOn 驗證

## Why

condition 的 then/else、loop 的 entry/done 目前都靠 `dependsOn: [designator]` 表達「被指定執行」。若有人誤把其他 step 寫成依賴 condition 或 loop（例如「不論分支都跑」的 step 寫 `dependsOn: [cond]`），語意會混亂且只能在執行時才發現。引入 **canBeDependedOn** 可讓 handler 宣告「此 step 不可被任意依賴」，引擎在驗證階段就限制：只有「被該 step 指定的」step（then/else 或 entry/done）才能寫 dependsOn 指向它，達到提前驗證。

## What Changes

- **IStepHandler 可選屬性**：新增 `canBeDependedOn?: boolean`（預設 true）。若為 false，表示此 step 的後繼僅由自身欄位指定（condition: then/else；loop: entry/done），不允許其他 step 的 dependsOn 包含此 step。
- **驗證規則**：在 run 前（或 dry-run/load 時）檢查：對每個 step，若其 handler 的 canBeDependedOn 為 false，則僅允許「該 step 的 then/else（condition）或 entry+done（loop）」中的 step id 出現在其他 step 的 dependsOn 裡指向它；若有其他 step 的 dependsOn 包含該 step，報錯並指出違規的 step id。
- **Handler 設定**：condition、loop 兩個 handler 實作設為 `canBeDependedOn: false`。其餘 handler 不設定（視為 true）。
- **不改排程**：then/else、entry/done 的 step 仍保留 `dependsOn: [designator]`；getRunnable 與 nextSteps 邏輯不變，僅新增上述驗證。

## Capabilities

### New Capabilities

- `handler-can-be-depended-on`: IStepHandler 可選 canBeDependedOn；引擎依此與 step 形狀（then/else、entry/done）驗證「誰可以依賴此 step」。

### Modified Capabilities

- （若 design 階段觸及 step-context、loop-step、condition-step 等 spec，可於 design 後補 delta。）

## Impact

- **@runflow/core**：types.ts 的 IStepHandler 新增 canBeDependedOn；executor（或獨立 validateFlow）在執行前依 registry 與 flow.steps 跑驗證；錯誤訊息需指出違規的 step id。
- **@runflow/handlers**：condition.ts、loop.ts 的 handler 類別加上 `canBeDependedOn: false`。
- **既有 flow**：無須改 YAML（then/else、entry/done 仍寫 dependsOn）；僅在有人誤把非指定 step 寫成依賴 condition/loop 時會開始報錯。
