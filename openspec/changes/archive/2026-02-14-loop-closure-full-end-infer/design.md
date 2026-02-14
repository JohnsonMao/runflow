# Design: Loop 語意 — 每輪結束點、完整 closure、不強調 early exit

## Context

主 spec（loop-step）已規定：end 僅用於可視化，引擎不得用 end 做執行。實作上 loop handler 曾用 end/done 過濾 closure，已改為完整 closure。使用者希望：(1) 不需特別「判斷 early exit」，改由**每輪結束點**（end = 一輪跑完的節點）決定何時進入下一輪或 done；(2) loop start / iteration i/N 能**插在 body 之間**顯示。

## 核心模型：每輪結束點，不強調 early exit

- **connect 取代 end**：一輪邊界由 **connect**（從 entry 連到的步驟）定義，不需 **end**。end 已不再用於執行或 getAllowedDependentIds。
- **一輪何時算結束**：跑 `runSubFlow(bodyStepIds)`。若**正常回傳**（沒有 step 回傳 nextSteps 指向 body 外），表示本輪跑完（到達 connect），**這一輪結束**。然後檢查 when/items/count → 若達成則回傳 **done**，否則**下一輪**（再跑一次 runSubFlow）。
- **控制離開本輪**：若 runSubFlow 回傳 **earlyExit**（某步回傳的 nextSteps 含 **closure 外** step id），表示有步驟「分支到 round 外」→ loop **立即結束**，回傳該 nextSteps，**不**跑 done。不需另立「early exit」判斷邏輯，runSubFlow 的 earlyExit 即代表「有 step 指向 round 外」。
- **小結**：不需單獨判斷「是否 early exit」；只區分兩種情況：(1) runSubFlow 正常回傳 → 一輪結束 → 依 when/items/count 決定 done 或下一輪；(2) runSubFlow 回傳 earlyExit → 離開 loop，回傳該 nextSteps，不跑 done。

## Goals / Non-Goals

**Goals:**

- **connect 定義一輪**：有 connect 時 body = forward(entry) ∩ backward(connect)；無 connect 時 body = closure 扣掉 done 與其下游。不再使用 end。
- **以「每輪結束」為主**：每輪跑完整 closure，跑完即一輪結束；再依 when/items/count 跑 done 或下一輪。只有「nextSteps 指向 closure 外」時才提前結束 loop 且不跑 done。
- **插在 body 之間**：支援將 loop start、iteration i/N 以某種形式呈現在 body steps 之間（見下方決策）。

**Non-Goals:**

- 不改變 runSubFlow 的語意：scope 外 nextSteps 仍由 executor 判定為 earlyExit，loop 僅依此回傳、不跑 done。

## Decisions

### 1. Closure / body：connect 定義一輪，或沿用 done 排除

- **Choice**：
  - **有 connect 時**：一輪 = 從 entry **連到** connect 的路徑。`bodyStepIds = forwardClosure(entry) ∩ backwardClosure(connect)`。UI 上可視為 subflow 主動「連接回」connect；移動到 closure 外即中斷 loop（early exit）。
  - **無 connect 時**：沿用「closure 扣掉 done 與依賴 done 的步驟」：`excludedFromBody = closureIdsThatDependOnDone(...)`，`bodyStepIds = closureIds.filter(id => !excludedFromBody.has(id))`。
- **Rationale**：用 connect 可由圖與演算法決定「一輪」邊界，不需依賴 end；無 connect 時保持向後相容。

### 2. 何時一輪結束、何時離開 loop（不另判 early exit）

- **Choice**：
  - **一輪結束**：runSubFlow(bodyStepIds) 正常回傳（無 earlyExit）→ 本輪跑完（到達 connect）→ 一輪結束。接著依 when/items/count 回傳 done 或跑下一輪。
  - **離開 loop**：runSubFlow 回傳 earlyExit（某步 nextSteps 含 closure 外 id）→ loop 立即結束，回傳該 nextSteps，不跑 done。
- **Rationale**：不需額外「判斷是否 early exit」；runSubFlow 的 earlyExit 即代表「有 step 指向 round 外」，loop 只依此做一種分支即可。

### 3. end 不再使用

- **Choice**：一輪邊界改由 **connect** 定義；**end** 不再用於執行或驗證。既有 flow 若有 `end` 可保留作相容，引擎忽略。
- **Rationale**：connect 已表達「一輪連到哪裡」，UI 可視化用 connect 即可。

### 4. 插在 body 之間：loop start / iteration i/N 的呈現方式

- **選項 A（建議後續實作）**：**Marker / 合成 step**。Executor 或 StepContext 提供 API（例如 `context.pushMarkerStep?(stepId, log)`），讓 loop handler 在適當時機 push 僅含 stepId + log 的「標記 step」到主 steps。順序例：push marker `loop._start`（log: "loop start"）→ runBody 輪1（body 步驟即時 push）→ push marker `loop._iteration_1`（log: "iteration 1/N"）→ runBody 輪2 → … → 最後 push 本步 loop 的 StepResult（或僅 log "loop complete"）。需擴充 StepContext 與 executor。
- **選項 B**：**Display 層虛擬插入**。RunResult.steps 維持現狀（body 步驟 + 單一 loop step）；MCP/CLI 顯示時，依 loop step 的 log 拆成多行，並在 UI 上將「loop start」「iteration i/N」虛擬插在對應 body 區段之間（不改資料結構）。
- **選項 C**：**appendLog 即時 flush 為 step**。appendLog 時除累積外，可選擇「立即 push 一個僅 log 的 step」（需 executor 支援、可能產生大量 step）。
- **Choice**：本 change 僅**描述**需求與選項 A/B/C；實作上先維持「單一 loop step + 合併 log」，可選將「iteration i/N」改為在 runBody **之後** append，使 log 文字順序對應「每輪結束後再標記」。插在 body 之間的正式支援列為後續（**建議採用 A**，見下）。
- **Rationale**：插在 body 之間需 API 或顯示層變更，與「每輪結束點／不強調 early exit」的語意變更可拆分。

**建議（GUI / Server 皆適用）：選項 A（Marker step）**

- **單一契約**：`RunResult.steps` 即為「依執行順序的完整列表」，含 body 與 marker。Server 只負責儲存/回傳同一份結構；GUI、CLI、MCP 一律依 `steps` 順序渲染，不需再解析或擴展。
- **Server**：無需額外邏輯；持久化與 API 回傳同一 `RunResult`。若日後做「顯示用 view」API，也只做篩選或欄位選取，不必依 log 字串拆解或推斷順序。
- **GUI**：依序渲染每個 step（含 marker）；marker 可另設樣式（例如標籤列、縮排）。不需解析 loop step 的 log、也不需推斷「哪幾步屬於第幾輪」。
- **不綁 log 格式**：順序寫在資料裡，不依賴「loop start\niteration 1/3\n...」等字串格式；log 文案變更不影響結構。
- **相較 B**：B 需每個 client（GUI、Server 若提供顯示用 API、MCP）實作同一套「依 log 與 body 區段虛擬插入」邏輯，且要能對應 body 與輪次，易碎且重複。**A 把結構放在資料，client 只做渲染。**
- **相較 C**：C 等同「每次 appendLog 都變成 step」，step 數量暴增、且把「日誌」與「步驟」混在一起；若只對 loop 開特例又與 A 重疊。**A 用明確的 pushMarkerStep 語意較清晰。**

### 5. 迭代 log：iteration i/N 在 runBody 之後（可選）

- **Choice**：可將 `context.appendLog?.(`iteration ${i}/${n}`)` 改為在該輪 **runBody 回傳後** 再 append，使合併後的 log 順序為：loop start → iteration 1/N → iteration 2/N → … → loop complete（對應「每輪結束後再標記」）。
- **Rationale**：在不改 steps 結構的前提下，改善 log 閱讀順序。

## 實作要點

- **packages/handlers/src/loop.ts**：已改為 closure = `computeLoopClosure(...)`，不依 end/done 過濾。一輪結束與離開 loop 的邏輯維持：runSubFlow 正常回傳 → 檢查 when/items/count → done 或下一輪；runSubFlow 回傳 earlyExit → 回傳該 nextSteps，不跑 done。
- **openspec/specs/loop-step**：以 delta 寫明「每輪結束點」模型、「一輪結束後依 when/items/count 跑 done 或下一輪」、「nextSteps 指向 closure 外時離開 loop 且不跑 done」；可選補充「插在 body 之間」的後續方向（marker step 或 display 層）。
