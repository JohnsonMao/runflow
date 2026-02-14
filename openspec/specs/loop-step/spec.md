# loop-step Specification

## Purpose

Step type `loop`: runs a **loop body sub-graph** repeatedly, driven by exactly one of `items`, `count`, or `when`. The iteration scope is the **closure from entry** (computed from the flow's steps and dependsOn). The closure is executed by the **same executor** (same DAG, condition, nextSteps semantics) so that body steps can branch, run in DAG order, and **early exit** by returning nextSteps that point outside the closure. No fixed execution order or handler-coupled step id lists; the engine layer runs the closure as a sub-flow each iteration.

## Requirements

### Requirement: Loop step SHALL have exactly one of items, count, or when

A flow step with `type: 'loop'` MUST have exactly one of the following (after template substitution):

- **items**: array to iterate over. Each iteration receives `params.item`, `params.index`, `params.items`.
- **count**: non-negative number of iterations. Each iteration receives `params.index`, `params.count`.
- **when**: string expression. After each iteration run, the engine evaluates it with the current context; when true, the loop ends normally (nextSteps: done).

If none or more than one of these is present, the step SHALL be invalid (validation error or StepResult success: false with error message).

#### Scenario: Invalid loop — missing or multiple drivers

- **WHEN** a loop step has no `items`, no `count`, and no `when` (or two or more of them set)
- **THEN** validation SHALL fail or the handler SHALL return StepResult with success: false and an error describing the requirement (exactly one of items/count/when)

### Requirement: Loop step SHALL have entry (entry points only); iteration scope is closure from entry minus done; done and optional end

- **entry** (required): one or more step ids that are the **entry point(s)** of the loop. The iteration scope (steps run each iteration) SHALL be the **forward transitive closure** from entry, **minus** (1) any step id listed in `done` and (2) any step in the closure that **transitively depends on** a done step. The engine SHALL NOT remove any step id from this closure based on `end` alone. Done and its downstream steps SHALL be excluded from the iteration body so they run **once** when the loop returns nextSteps (after all rounds complete). The engine SHALL run this **closure** as a sub-flow each iteration (same executor, DAG order, when/condition/nextSteps). The engine SHALL provide a way (e.g. context.steps and closure computation in the handler) to compute the closure from the flow's steps and dependsOn.

- **done** (optional): array of step ids that the loop step **returns as `nextSteps`** when the loop completes **normally** (items exhausted, count reached, or when expression true). On normal completion the loop step's StepResult SHALL include `nextSteps: done`. Done is not run by the loop; it is the branch target.

- **end** (optional): step id or array of step ids denoting **round end**; when present, the UI SHALL draw an edge from each end step back to the loop step (closed loop). When absent, the engine or UI MAY infer end as the **sink(s) of the closure**. The engine SHALL NOT use end to exclude steps from the closure; execution SHALL always run the full closure (minus done and its dependents) each iteration (unless early exit).

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

#### Scenario: Full closure each round minus done; end as round end only

- **GIVEN** a loop step with `entry: [loopBody]`, `done: [nap]`, closure from loopBody includes loopBody, earlyExitCond, noop, nap2, nap (nap has dependsOn: [loop])
- **WHEN** the executor runs the loop
- **THEN** the handler SHALL pass body = closure minus (done ∪ steps that transitively depend on done) (e.g. [loopBody, earlyExitCond, noop, nap2]; nap, req, sub, summary excluded) to runSubFlow each iteration
- **AND** the handler SHALL exclude `done` and any step that depends on done (transitively) from the iteration body so they run once when the loop returns nextSteps
- **AND** the handler SHALL NOT exclude any step id based on `end` alone
- **AND** when `end` is omitted, the engine or UI MAY infer end as the sink nodes of the closure (e.g. [noop, nap2])

### Requirement: Round complete vs control leaves round; done only on round complete

- **Round complete**: When runSubFlow(closureIds) returns **without** earlyExit (no step returned nextSteps containing a step id outside the closure), the round SHALL be considered complete. The engine SHALL then evaluate when/items/count; if the loop is done (items exhausted, count reached, or when expression true), the loop step SHALL return `nextSteps: done` and the executor SHALL run done steps once. Otherwise the engine SHALL run the next round (runSubFlow again).

- **Control leaves round**: When runSubFlow returns **with** earlyExit (a step returned nextSteps that include a step id **not** in the closure), the loop SHALL complete immediately with that same nextSteps. The executor SHALL continue with those steps. The loop step SHALL NOT return done; done SHALL NOT be run.

#### Scenario: Round complete then done

- **GIVEN** a loop step with `count: 2`, `entry: [A]`, `done: [D]`, closure {A, B, C}; no step returns nextSteps outside the closure
- **WHEN** runSubFlow runs twice and each time returns normally
- **THEN** after the second round the loop SHALL return `nextSteps: [D]`; the executor SHALL run D once

#### Scenario: Control leaves round; done is not run

- **GIVEN** a loop step with `entry: [A]`, `done: [D]`, closure {A, B, C}; step B returns `nextSteps: [out]` where out is not in the closure
- **WHEN** B returns that nextSteps during an iteration
- **THEN** runSubFlow SHALL return earlyExit with that nextSteps; the loop SHALL complete with `nextSteps: [out]`
- **AND** the executor SHALL continue with step out; step D (done) SHALL NOT be run

### Requirement: Early exit — use step's nextSteps; entire iteration stops; done is not used

When during an iteration any step in the **closure** returns `nextSteps` that include a step id **not** in the closure, the engine SHALL treat this as **early exit**: stop the current iteration immediately, do not run further steps in the closure in that iteration, do not run or schedule done. The loop step SHALL complete with that **same nextSteps**. The executor continues with those steps. So on early exit, control goes to the step's nextSteps and done is ignored.

#### Scenario: Early exit — use step's nextSteps; done is not run

- **GIVEN** a loop step with `count: 10`, `entry: [A]`, `done: [C]`; closure is {A, B}; step B is a condition that returns `nextSteps: [out]` where `out` is not in the closure
- **WHEN** on the third iteration B returns `nextSteps: [out]`
- **THEN** the engine exits the loop immediately (early exit)
- **AND** the current iteration SHALL not run any further steps in the closure; the loop step completes with `nextSteps: [out]`; the executor continues with step `out`

### Requirement: Loop step SHALL NOT couple execution order to a fixed list

The loop step SHALL NOT require the engine to execute iteration steps in a fixed order. Order SHALL be determined by the **executor** from the sub-graph (closure). The executor SHALL run the closure as a sub-flow so that condition and nextSteps drive branching and early exit.

#### Scenario: Loop with when driver; normal completion returns nextSteps: done

- **GIVEN** a loop step with `when: 'params.body.iterIndex >= 2'`, `entry: [body]`, `done: [after]` where the closure is {body}
- **WHEN** the executor runs the loop
- **THEN** for each iteration the executor runs the closure until the when expression is true
- **AND** on normal exit the loop step returns `nextSteps: [after]` (done); the executor continues with step after

### Requirement: Entry, end, and done step ids are in the same flow

Entry step ids SHALL reference steps that exist in the same flow definition; the closure is computed from that flow. Done and end step ids SHALL reference steps in the same flow (done used as nextSteps on normal completion; end used only for visualization). When a handler (e.g. loop) calls `runSubFlow` with ids that are not in the flow, the executor SHALL return an error so the step fails with a clear message (see step-context: runSubFlow SHALL validate body step ids).

#### Scenario: Entry and done reference same-flow steps

- **WHEN** a flow has a loop step with `entry: [A]`, `done: [C]`
- **THEN** step ids A and C SHALL exist in the same flow definition
- **AND** the engine SHALL compute the closure from entry using the flow's steps and run that closure each iteration; on normal completion the loop SHALL return nextSteps: [C]

### Requirement: When end is omitted, engine MAY infer end as closure sinks

When the loop step does not specify `end`, the engine or UI MAY compute the set of step ids that are sinks of the closure and use that set as the inferred end for visualization and for the "round end" semantic. This inference SHALL NOT change which steps are run; the full closure (minus done and its dependents) SHALL still be run each iteration.

#### Scenario: Infer end when omitted

- **GIVEN** a loop step with `entry: [loopBody]` and no `end` field; closure is {loopBody, earlyExitCond, noop, nap2} where noop and nap2 are sinks
- **WHEN** the engine or UI needs an end set (e.g. for drawing or round-end semantic)
- **THEN** it MAY infer end as [noop, nap2]
- **AND** the handler SHALL still run the full closure each iteration

## BREAKING CHANGES

- Previous loop design with **body** (required list of step ids) and **until** (condition step id) is **replaced**. Use **entry** (entry point(s) only) and **items** / **count** / **when** as the single driver. Migration: replace `body: [A, B, C, ...]` with `entry: [A]` (or the true entry point(s)); the engine computes the closure. Remove `until`; use **when** (expression) for expression-based exit.
