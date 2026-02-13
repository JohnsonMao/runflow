# Loop Entry / End Redesign — Proposal

## Why

The current loop uses **body** and **done**, and we added **exitWhen/exitThen** for "check before body". That makes the model harder to reason about and the DAG less intuitive. We want a clear model: **entry** is only the **entry point(s)** (no need to list every step the loop touches); the engine computes which steps run each iteration from the DAG. We keep **end** (for closed-loop visualization) and **done** (where control goes when the loop finishes). No exitWhen; no body.

## What Changes

- **entry = 只會進入點**：Loop step SHALL have **entry** (one or more step ids). Entry is **not** the full list of steps in the iteration—only the **seed(s)**. The **iteration scope** (steps that run each iteration) SHALL be the **forward transitive closure** from entry (see below). **BREAKING**: existing `body` is removed; flows use `entry` as entry points only.

- **Iteration scope = closure from entry**：From the flow DAG, the engine computes the set of steps that run in one iteration: start with **entry**; then add any step S such that every step in S's `dependsOn` is either the **loop step** or already in the set. Repeat until fixed point. That set is the **closure**. Each iteration runs exactly that closure as a sub-flow (same executor, DAG order, early exit when nextSteps go outside the closure). So the author does **not** list A, B, C, D—only **entry: A**; the engine derives A→B→C→D from dependsOn.

- **end (optional)**：Which node(s) are the **tail of an iteration** for **visualization**. The UI draws an edge from **end** back to the loop node (closed loop). If omitted, **end** SHALL be inferred as the **sink(s) of the closure** (steps in the closure that no other step in the closure depends on). If specified (e.g. `end: C`), use it for drawing only; execution still runs the full closure (e.g. still runs D after C). **BREAKING** for spec: new field.

- **Keep done**：When the loop completes (normal or early exit), control goes to **done**: normal completion returns `nextSteps: done`; early exit returns the nextSteps from the step that broke out. No change.

- **Remove exitWhen / exitThen**：No "check before entry" at loop level. Early exit only via a step in the **closure** returning nextSteps outside the closure. **BREAKING**: remove from loop step and handler.

- **Execution remains DAG**：No runtime cycle. Each iteration runs the closure once; then next iteration or done. The closed loop (end → loop) is a **visual** convention only.

## Closure and end inference

- **Closure from entry**（前向閉包）：Given loop step id `L` and **entry** set E. Let `scope = E`. For each step S in the flow: if every id in S's `dependsOn` is either `L` or in `scope`, add S to `scope`. Repeat until `scope` is stable. Steps outside the flow or with invalid dependsOn are not added. The loop runs `scope` each iteration.

- **Sink of the closure**：Step S in `scope` is a **sink** iff no other step T in `scope` has `dependsOn` containing S. **Inferred end** = all sinks of the closure. Author can override with explicit **end** (for diagram only).

## Examples (execution and end)

All examples assume the loop step id is `loop` and steps have `dependsOn` as stated. "後續沒依賴" = no step in the flow has that step in their dependsOn (i.e. it's a sink in the full graph for that chain).

---

**例 1：count 2, entry A, done E（不寫 end）**

- A → B → C → D（D 後續沒依賴）
- **Closure from [A]** = {A, B, C, D}. **Inferred end** = [D].
- **執行**：A → B → C → D → A → B → C → D → E.

---

**例 2：count 2, entry A, end C, done E**

- A → B → C → D（D 後續沒依賴）
- **Closure** = {A, B, C, D}. **end** 指定為 C（只影響畫圖：從 C 畫回 Loop）。執行仍跑完整 closure。
- **執行**：A → B → C → D → A → B → C → D → E.
- 無衝突：done E 僅在**正常結束**時使用；end C 僅影響畫圖，不改變執行順序。

---

**例 3：count 2, entry A, end C, done E；B 有 condition 條件達成時 nextSteps [F]**

- A → B → C → D（D 後續沒依賴）
- **Closure** = {A, B, C, D}. 第 2 輪跑 A → B，B 回傳 nextSteps [F]（F 不在 closure）→ early exit，不跑 C、D.
- **執行**：A → B → C → D → A → B → F.
- 無衝突：**early exit 時 nextSteps 用 B 回傳的 [F]，不用 done E**（done 僅用於正常結束）。end C 仍只影響畫圖（第 2 輪未執行到 C 也無妨，end 是「結構上的迭代尾端」）。

---

**例 4：count 2, entry [A, G], end D, done J**

- A → B → C → D 後續沒依賴；G → H → D 後續沒依賴（兩條鏈匯到 D）
- **Closure from [A, G]** = {A, B, C, D, G, H}. **Inferred end** = [D]（可覆寫為 `end: D`）。D 為兩鏈匯合點，需等兩邊都到才跑 D.
- **執行**（DAG 序）：A, G → B, H → C → D（等 A 鏈與 G 鏈）；下一輪同上；最後 done → J. （D、J 會等到合併兩條鏈再往下。）

---

**例 5：count 2, entry [A, G], end [D, E], done J**

- A → B → C → D 後續沒依賴；G → H → D → E 後續沒依賴
- **Closure** = {A, B, C, D, G, H, E}. **end** = [D, E]（兩條鏈的尾端）。D 匯合後再跑 E.
- **執行**：A, G → B, H → C, (D 等 C,H) → D → E；第二輪同上；再 → J. D、J 會等到合併兩個節點一起做事情。

---

**例 6：count 2, entry [A, G], end [D, E], done J；B 有 condition 條件達成提前 nextSteps [F]**

- 同例 5 的 DAG
- **Early exit 語意（避免衝突）**：任一 step 回傳 nextSteps 超出 closure 時，**整輪立刻結束**，該輪 closure 內其餘 step 皆不跑；loop 以該 nextSteps 完成（不採用 done）。故第 2 輪 B 回傳 [F] 後，不跑 C、D，也**不跑 G、H、D、E**（不讓 G 鏈「繼續跑完」再與 F 競爭），否則會產生「要往 F 還是往 J」的邏輯衝突。
- **執行**：第一輪 A,B,C,D + G,H,D,E（D 等兩鏈匯合）；第二輪 A → B → F（整輪中止，不跑 C,D 與 G,H,D,E）。「D 會等到合併」僅指**第一輪**的 D。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- **loop-step**: REQUIREMENTS change: loop step SHALL use **entry** (required, entry points only). Iteration scope SHALL be the forward transitive closure from entry (engine computes from flow DAG). SHALL have optional **end** (step ids) for iteration-tail visualization (closed loop); if omitted, infer as sinks of the closure. SHALL keep **done** (optional). Loop SHALL NOT support exitWhen/exitThen or body. Early exit: when any step in the closure returns nextSteps outside the closure, loop completes with that nextSteps.

## Impact

- **@runflow/core**: Executor (or loop handler) must compute **closure(entry)** from the flow's steps and dependsOn before calling runSubFlow. So the engine must provide the loop handler with the full step list (or a way to resolve closure from entry). runSubFlow is called with the **closure** ids, not just entry.
- **@runflow/handlers (loop)**: Validation: require **entry** (one or more ids), optional **end** and **done**; remove body, exitWhen, exitThen. In run(), compute closure from entry using context (e.g. context must expose steps or getClosure(entry) helper).
- **Flow YAML**: Use **entry** with only entry point(s); optionally **end** for diagram; keep **done**.
- **UI / MCP / discover**: Draw closed loop: use **end** if present; else infer end as sinks of the closure from entry. Draw edges from each end step back to the loop step.
- **Specs**: `openspec/specs/loop-step/spec.md` updated via delta.
