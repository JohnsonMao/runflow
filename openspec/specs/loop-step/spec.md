# loop-step Specification

## Purpose

Step type `loop`: runs a **loop body sub-graph** repeatedly, driven by exactly one of `items` or `count`. The iteration scope is the **closure from entry** (computed from the flow's steps and dependsOn). Each iteration the handler builds a **sub-flow** from that closure (minus done and its dependents), calls **context.run(subFlow, bodyCtx)**, and uses the RunResult (steps, finalParams, earlyExit). The same DAG/condition/nextSteps semantics apply so that body steps can branch and **early exit** by returning nextSteps outside the scope; when the run returns earlyExit, the loop completes with that nextSteps. No fixed execution order or handler-coupled step id lists; the engine runs the sub-flow as a normal flow each iteration.

## Requirements

### Requirement: Loop step SHALL have exactly one of items or count

A flow step with `type: 'loop'` MUST have exactly one of the following (after template substitution):

- **items**: array to iterate over. Each iteration receives `params.item`, `params.index`, `params.items`.
- **count**: non-negative number of iterations. Each iteration receives `params.index`, `params.count`.

If none or more than one of these is present, the step SHALL be invalid.

#### Scenario: Invalid loop — missing or multiple drivers

- **WHEN** a loop step has no `items` and no `count` (or both are set)
- **THEN** validation SHALL fail or the handler SHALL return StepResult with success: false and an error describing the requirement (exactly one of items/count)

### Requirement: Loop step SHALL have entry (entry points only)

- **entry** (required): one or more step ids that are the **entry point(s)** of the loop. The iteration scope (steps run each iteration) SHALL be the **forward transitive closure** from entry. The engine SHALL run this **closure** as a sub-flow each iteration.

#### Scenario: Entry point defines the loop body

- **GIVEN** a loop step with `entry: [A]` and a flow where A -> B -> C
- **WHEN** the loop runs
- **THEN** the steps A, B, and C SHALL be included in the loop body

### Requirement: Iteration body SHALL exclude done steps and their dependents

The iteration body SHALL be the closure from entry **minus** (1) any step id listed in `done` and (2) any step in the closure that **transitively depends on** a done step. Done and its downstream steps SHALL be excluded from the iteration body so they run **once** when the loop returns nextSteps (after all rounds complete).

#### Scenario: Exclude done from iteration body

- **GIVEN** a loop step with `entry: [loopBody]`, `done: [nap]`, closure from loopBody includes loopBody, noop, nap, summary (summary depends on nap)
- **WHEN** the executor runs the loop
- **THEN** the handler SHALL run only [loopBody, noop] each iteration
- **AND** nap and summary SHALL be excluded as they are part of the done path

### Requirement: Loop step MAY have iterationCompleteSignals to define iteration boundaries

- **iterationCompleteSignals** (optional): array of step ids. When present, an iteration is considered successful ONLY if at least one of these steps is executed successfully within the sub-flow run. If the sub-flow finishes without reaching any of these signal steps, the loop SHALL terminate early with `nextSteps: null`.

#### Scenario: Terminate early on missing completion signal

- **GIVEN** a loop step with `count: 2`, `entry: [A]`, `iterationCompleteSignals: [S]`
- **WHEN** in the first iteration step `A` runs but `S` is never reached or fails
- **THEN** the loop handler SHALL return StepResult with `success: true`, but with `nextSteps: null` to signal termination
- **AND** the log SHALL indicate `loop terminated early after 1 iteration(s) (no completion signal reached)`
- **AND** all iteration traces (sub-steps) collected so far MUST be included in the results

### Requirement: Round complete vs control leaves round; done only on round complete

- **Round complete**: When the sub-flow run returns **without** unconsumed `nextSteps`, the round SHALL be considered complete. The handler SHALL then evaluate if the loop is done (items exhausted or count reached). If done, the loop step SHALL return `nextSteps: done`.
- **Control leaves round**: When the run returns **with** unconsumed `nextSteps`, the loop SHALL complete immediately with that same nextSteps.

#### Scenario: Round complete then done

- **GIVEN** a loop step with `count: 2`, `entry: [A]`, `done: [D]`, closure {A, B, C}; no step returns nextSteps targeting a step outside {A, B, C}
- **WHEN** the run is invoked twice (two iterations) and each time returns without unconsumed nextSteps
- **THEN** after the second round the loop SHALL return `nextSteps: [D]`

#### Scenario: Control leaves round; done is not run

- **GIVEN** a loop step with `entry: [A]`, `done: [D]`, closure {A, B, C}; step B returns `nextSteps: [out]` where out is not in {A, B, C}
- **WHEN** B returns that nextSteps during an iteration
- **THEN** the loop SHALL complete with `nextSteps: [out]` and step D (done) SHALL NOT be run

### Requirement: Early exit — use step's nextSteps; entire iteration stops

When during an iteration any step in the **closure** returns `nextSteps` that target a step id **not** in the closure, the loop handler SHALL treat this as **early exit**: stop the current iteration immediately, and return that same nextSteps.

#### Scenario: Early exit — use step's nextSteps; done is not run

- **GIVEN** a loop step with `count: 10`, `entry: [A]`, `done: [C]`; closure is {A, B}; step B is a condition that returns `nextSteps: [out]` where `out` is not in the closure
- **WHEN** on the third iteration B returns `nextSteps: [out]`
- **THEN** the loop handler exits the loop immediately (early exit)
- **AND** the current iteration SHALL not run any further steps in the closure; the loop step completes with `nextSteps: [out]`

### Requirement: Loop step SHALL NOT couple execution order to a fixed list

The loop step SHALL NOT require the engine to execute iteration steps in a fixed order. Order SHALL be determined by the **executor** from the sub-graph (closure).

#### Scenario: Execution order determined by DAG

- **GIVEN** a loop step with `entry: [A, B]` where C depends on A and B
- **WHEN** the loop runs
- **THEN** the executor SHALL run A and B first (in any order) and then C

### Requirement: Entry, end, and done step ids SHALL be in the same flow

Entry, end, and done step ids SHALL reference steps that exist in the same flow definition; the closure is computed from that flow.

#### Scenario: Validate step IDs in flow

- **WHEN** a loop step specifies `entry: [NonExistent]`
- **THEN** validation SHALL fail or the handler SHALL return an error result

### Requirement: When end is omitted, engine SHALL infer end as closure sinks

When the loop step does not specify `end`, the engine or UI SHALL compute the set of step ids that are sinks of the closure and use that set as the inferred end for visualization.

#### Scenario: Infer end sinks

- **GIVEN** a loop step with `entry: [A]` where A -> B and A -> C (B and C are sinks)
- **WHEN** visualizing the loop
- **THEN** B and C SHALL be used as the loop-back points in the UI

### Requirement: Loop handler SHALL return subSteps for execution order

The loop handler SHALL return **subSteps** on its StepResult for each iteration: for each round it SHALL append a marker step (e.g. `iteration_${i+1}`) and then each step result from the run with its stepId (e.g. `iteration_${i+1}.${bodyStepId}`). The engine SHALL then flatten these subSteps into RunResult.steps, prefixing them with the loop step's ID.

#### Scenario: Loop with subSteps yields ordered flattened steps

- **GIVEN** a loop step with `id: l1`, `count: 2`, `entry: [A]`, closure {A}
- **WHEN** the loop handler runs and returns subSteps including markers and step results
- **THEN** RunResult.steps (after engine flattening) SHALL contain in order: `l1.iteration_1`, `l1.iteration_1.A`, `l1.iteration_2`, `l1.iteration_2.A`, then the loop step's own result `l1`

## BREAKING CHANGES

- Previous loop design with **body** (required list of step ids) and **until** (condition step id) is **replaced**. Use **entry** (entry point(s) only) and **items** / **count** as the driver. Migration: replace `body: [A, B, C, ...]` with `entry: [A]` (or the true entry point(s)); the engine computes the closure. Remove `until`; use `iterationCompleteSignals` or condition steps inside the loop for control.
