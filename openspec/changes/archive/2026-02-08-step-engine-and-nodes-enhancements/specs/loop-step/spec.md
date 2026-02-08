# loop-step Specification

## Purpose

Step type `loop`: runs a **loop body sub-graph** repeatedly, driven by exactly one of `items`, `count`, or `until`. The body is executed by the **same executor** (same DAG, condition, nextSteps semantics) so that body steps can branch, run in DAG order, and **early exit** by returning nextSteps that point outside the body. No fixed execution order or handler-coupled step id lists; the engine layer runs the body as a sub-flow each iteration.

## ADDED Requirements

### Requirement: Loop step SHALL have exactly one of items, count, or until

A flow step with `type: 'loop'` MUST have exactly one of the following (after template substitution):

- **items**: array to iterate over. Each iteration receives `params.item`, `params.index`, `params.items`.
- **count**: non-negative number of iterations. Each iteration receives `params.index`, `params.count`.
- **until**: step id of a condition step. After each body run, the engine runs this step; when its result indicates exit (e.g. `nextSteps` matching an exit branch), the loop ends.

If none or more than one of these is present, the step SHALL be invalid (validation error or StepResult success: false with error message).

### Requirement: Loop body is a sub-graph run by the executor; done is nextSteps (like condition then/else)

- **body** (required): array of step ids that form the **loop body sub-graph**. These steps MAY have `dependsOn` among themselves; execution order within an iteration SHALL be determined by the **executor** (DAG topological order among body steps), not by array order. The executor SHALL run the body sub-graph each iteration using the same execution model as the top-level flow: when/condition/nextSteps apply. Body step outputs SHALL be merged into the iteration context for the next iteration or for the loop step’s final outputs.

- **done** (optional): array of step ids that the loop step **returns as `nextSteps`** when the loop completes **normally** (items exhausted, count reached, or until indicates exit). Same semantics as condition step’s then/else: the loop step’s StepResult SHALL include `nextSteps: done` so the executor continues with those steps. Done is **not** a sub-graph to run; it is the branch target for normal completion.

### Requirement: Early exit — use body’s nextSteps directly; do not run done

When during a body iteration any step returns `nextSteps` that include a step id **not** in the body, the engine SHALL treat this as **early exit**: stop the current iteration, do not run further body steps, **do not run or schedule done**. The loop step SHALL complete with that **same nextSteps** (the one returned by the body step). The executor continues with those steps; the loop step is complete. So on early exit, control goes directly to the steps indicated by the body step’s nextSteps, and done is ignored.

### Requirement: Loop step SHALL NOT couple execution order to a fixed list

The loop step SHALL NOT require the engine to execute body steps in a fixed order (e.g. always A then B). Order SHALL be determined by the **executor** from the sub-graph (DAG of body steps). Handlers SHALL NOT receive a single “run these ids in this order” contract for the loop body; the executor SHALL run the body as a sub-flow so that condition and nextSteps can drive branching and early exit.

#### Scenario: Loop with items and body; normal completion returns nextSteps: done

- **GIVEN** a loop step with `items: [1, 2, 3]`, `body: [A, B]`, `done: [C]` where A and B have `dependsOn` so that B depends on A
- **WHEN** the executor runs the loop
- **THEN** for each item the executor runs a sub-execution over steps A, B in DAG order (A then B)
- **AND** each iteration receives `params.item`, `params.index`, `params.items`
- **AND** after three iterations the loop completes normally; the loop step returns `nextSteps: [C]` (done); the executor continues with step C

#### Scenario: Early exit — use body’s nextSteps; done is not run

- **GIVEN** a loop step with `count: 10`, `body: [A, B]`, `done: [C]`; step B is a condition that returns `nextSteps: [out]` where `out` is not in body
- **WHEN** on the third iteration B returns `nextSteps: [out]`
- **THEN** the engine exits the loop immediately (early exit)
- **AND** done is **not** run; the loop step completes with `nextSteps: [out]`
- **AND** the executor continues with step `out`; loop step is complete

#### Scenario: Until-driven exit; then nextSteps: done

- **GIVEN** a loop step with `until: check`, `body: [A, B]`, `done: [C]`, and a step `check` (condition) that returns nextSteps indicating exit
- **WHEN** after an iteration the executor runs `check` and it returns nextSteps that mean “exit”
- **THEN** the loop exits normally; the loop step returns `nextSteps: [C]` (done); the executor continues with C

#### Scenario: Invalid loop — missing or multiple drivers

- **WHEN** a loop step has no `items`, no `count`, and no `until` (or two or more of them set)
- **THEN** validation SHALL fail or the handler SHALL return StepResult with success: false and an error describing the requirement (exactly one of items/count/until)

### Requirement: Body and done step ids are in the same flow

Body step ids SHALL reference steps that exist in the same flow definition; the executor runs them as a sub-graph each iteration. Done step ids SHALL reference steps in the same flow; they are only used as the value of `nextSteps` on normal loop completion (not run by the loop step itself).

## BREAKING CHANGES

- Previous loop design (optional `run` JS per item, no body/done, no early exit) is **replaced**. Flows that relied on `loop` with only `items` and optional `run` SHALL be updated to the new shape: exactly one of items/count/until, required `body`, optional `done` (nextSteps on normal completion); body run by executor as sub-graph; early exit returns body’s nextSteps and does not run done.
