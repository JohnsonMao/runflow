# loop-step — Delta Spec (loop-entry-end-redesign)

## MODIFIED Requirements

### Requirement: Loop step SHALL have exactly one of items, count, until, or when

A flow step with `type: 'loop'` MUST have exactly one of the following (after template substitution):

- **items**: array to iterate over. Each iteration receives `params.item`, `params.index`, `params.items`.
- **count**: non-negative number of iterations. Each iteration receives `params.index`, `params.count`.
- **until**: step id of a condition step. After each iteration run, the engine runs this step; when its result indicates exit (e.g. `nextSteps` matching an exit branch), the loop ends.
- **when**: string expression. After each iteration run, the engine evaluates it with the current context; when true, the loop ends normally (nextSteps: done).

If none or more than one of these is present, the step SHALL be invalid (validation error or StepResult success: false with error message).

#### Scenario: Invalid loop — missing or multiple drivers

- **WHEN** a loop step has no `items`, no `count`, no `until`, and no `when` (or two or more of them set)
- **THEN** validation SHALL fail or the handler SHALL return StepResult with success: false and an error describing the requirement (exactly one of items/count/until/when)

### Requirement: Loop step SHALL have entry (entry points only); iteration scope is closure from entry; done and optional end

- **entry** (required): one or more step ids that are the **entry point(s)** of the loop. The iteration scope (steps run each iteration) SHALL be the **forward transitive closure** from entry: start with entry; add any step S such that every id in S's `dependsOn` is either the loop step id or already in the set; repeat until stable. The engine SHALL run this **closure** as a sub-flow each iteration (same executor, DAG order, when/condition/nextSteps). The engine SHALL provide a way (e.g. getLoopClosure on context) to compute the closure from the flow's steps and dependsOn.

- **done** (optional): array of step ids that the loop step **returns as `nextSteps`** when the loop completes **normally** (items exhausted, count reached, until/when indicates exit). On normal completion the loop step's StepResult SHALL include `nextSteps: done`. Done is not run by the loop; it is the branch target.

- **end** (optional): step id or array of step ids used **only for visualization**. When present, the UI SHALL draw an edge from each end step back to the loop step (closed loop). When absent, the UI MAY infer end as the **sink(s) of the closure** (steps in the closure that no other step in the closure depends on). The engine SHALL NOT use end for execution; execution SHALL always run the full closure each iteration (unless early exit).

#### Scenario: Entry only; closure run each iteration; done on normal completion

- **GIVEN** a loop step with `count: 2`, `entry: [A]`, `done: [E]` where A → B → C → D (B depends on A, C on B, D on C) and D has no dependents in the flow
- **WHEN** the executor runs the loop
- **THEN** the closure from [A] SHALL be {A, B, C, D}
- **AND** for each of 2 iterations the executor runs a sub-execution over A, B, C, D in DAG order
- **AND** after 2 iterations the loop step returns `nextSteps: [E]` (done); the executor continues with step E

#### Scenario: Multiple entry; closure merges; done on normal completion

- **GIVEN** a loop step with `count: 2`, `entry: [A, G]`, `done: [J]` where A → B → C → D, G → H → D (D is merge), and step ids exist in the flow
- **WHEN** the executor runs the loop
- **THEN** the closure from [A, G] SHALL include A, B, C, D, G, H
- **AND** each iteration runs in DAG order (e.g. A and G first, then B and H, then C, then D when both chains are ready)
- **AND** after 2 iterations the loop step returns `nextSteps: [J]`; the executor continues with step J

### Requirement: Early exit — use step's nextSteps; entire iteration stops; done is not used

When during an iteration any step in the **closure** returns `nextSteps` that include a step id **not** in the closure, the engine SHALL treat this as **early exit**: stop the current iteration immediately, do not run further steps in the closure in that iteration, do not run or schedule done. The loop step SHALL complete with that **same nextSteps**. The executor continues with those steps. So on early exit, control goes to the step's nextSteps and done is ignored.

#### Scenario: Early exit — use step's nextSteps; done is not run

- **GIVEN** a loop step with `count: 10`, `entry: [A]`, `done: [C]`; closure is {A, B}; step B is a condition that returns `nextSteps: [out]` where `out` is not in the closure
- **WHEN** on the third iteration B returns `nextSteps: [out]`
- **THEN** the engine exits the loop immediately (early exit)
- **AND** the current iteration SHALL not run any further steps in the closure; the loop step completes with `nextSteps: [out]`; the executor continues with step `out`

#### Scenario: Early exit with multiple entry — whole iteration stops

- **GIVEN** a loop step with `count: 2`, `entry: [A, G]`, closure {A, B, C, D, G, H, E}; step B can return `nextSteps: [F]`
- **WHEN** on the second iteration B returns `nextSteps: [F]` (F not in closure)
- **THEN** the engine SHALL stop the entire iteration (no further steps in the closure run, including G, H, D, E)
- **AND** the loop step completes with `nextSteps: [F]`; the executor continues with step F

### Requirement: Loop step SHALL NOT couple execution order to a fixed list

The loop step SHALL NOT require the engine to execute iteration steps in a fixed order. Order SHALL be determined by the **executor** from the sub-graph (closure). The executor SHALL run the closure as a sub-flow so that condition and nextSteps drive branching and early exit.

#### Scenario: Loop with when driver; normal completion returns nextSteps: done

- **GIVEN** a loop step with `when: 'params.body.iterIndex >= 2'`, `entry: [body]`, `done: [after]` where the closure is {body}
- **WHEN** the executor runs the loop
- **THEN** for each iteration the executor runs the closure until the when expression is true
- **AND** on normal exit the loop step returns `nextSteps: [after]` (done); the executor continues with step after

### Requirement: Entry, end, and done step ids are in the same flow

Entry step ids SHALL reference steps that exist in the same flow definition; the closure is computed from that flow. Done and end step ids SHALL reference steps in the same flow (done used as nextSteps on normal completion; end used only for visualization).

#### Scenario: Entry and done reference same-flow steps

- **WHEN** a flow has a loop step with `entry: [A]`, `done: [C]`
- **THEN** step ids A and C SHALL exist in the same flow definition
- **AND** the engine SHALL compute the closure from entry using the flow's steps and run that closure each iteration; on normal completion the loop SHALL return nextSteps: [C]

## REMOVED Requirements

### Requirement: Loop body is a sub-graph run by the executor; done is nextSteps (body as required list)

**Reason**: Replaced by entry (entry points only) and closure computed from the flow DAG. Body as a full list is no longer used.

**Migration**: Replace `body: [A, B, C, ...]` with `entry: [A]` (or the true entry point(s)). If the loop had a single logical entry A and the rest were A→B→C→..., use `entry: [A]`; the engine will compute closure {A, B, C, ...}. If multiple entry points, use `entry: [A, G]` etc.

### Requirement: exitWhen / exitThen on loop step

**Reason**: Removed to simplify the model; early exit is only via a step inside the closure returning nextSteps outside the closure. No "check before entry" at loop level.

**Migration**: If a flow used `exitWhen` and `exitThen` to exit to a step (e.g. nap2) before running the rest of the iteration, move that condition inside the closure (e.g. a condition step that returns nextSteps: [nap2]); the loop will early-exit when that step runs and returns.
