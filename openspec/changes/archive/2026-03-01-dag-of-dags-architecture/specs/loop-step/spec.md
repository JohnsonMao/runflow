## MODIFIED Requirements

### Requirement: Round complete vs control leaves round; done only on round complete

- **Round complete**: When the run (context.run(subFlow, bodyCtx)) returns **without** unconsumed `nextSteps` (no step returned nextSteps targeting a step id outside the current subFlow's `steps`), the round SHALL be considered complete. The handler SHALL then evaluate when/items/count; if the loop is done (items exhausted, count reached, or when expression true), the loop step SHALL return `nextSteps: done` and the executor SHALL run done steps once. Otherwise the handler SHALL run the next round (call context.run again).

- **Control leaves round**: When the run returns **with** unconsumed `nextSteps` (a step returned nextSteps that include a step id **not** in the subFlow's `steps`), the loop SHALL complete immediately with that same nextSteps. The executor SHALL continue with those steps in the parent flow. The loop step SHALL NOT return done; done SHALL NOT be run.

#### Scenario: Round complete then done

- **GIVEN** a loop step with `count: 2`, `entry: [A]`, `done: [D]`, closure {A, B, C}; no step returns nextSteps targeting a step outside {A, B, C}
- **WHEN** the run is invoked twice (two iterations) and each time returns without unconsumed nextSteps
- **THEN** after the second round the loop SHALL return `nextSteps: [D]`; the executor SHALL run D once

#### Scenario: Control leaves round; done is not run

- **GIVEN** a loop step with `entry: [A]`, `done: [D]`, closure {A, B, C}; step B returns `nextSteps: [out]` where out is not in {A, B, C}
- **WHEN** B returns that nextSteps during an iteration
- **THEN** the run SHALL return with unconsumed `nextSteps: [out]`; the loop SHALL complete with `nextSteps: [out]`
- **AND** the executor SHALL continue with step out; step D (done) SHALL NOT be run

### Requirement: Early exit — use step's nextSteps; entire iteration stops; done is not used

When during an iteration any step in the **closure** returns `nextSteps` that target a step id **not** in the closure, the loop handler SHALL treat this as **early exit**: stop the current iteration immediately, do not run further steps in the closure in that iteration, do not run or schedule done. The loop step SHALL complete with that **same nextSteps**. The executor continues with those steps in the parent flow. So on early exit, control goes to the step's nextSteps and done is ignored.

#### Scenario: Early exit — use step's nextSteps; done is not run

- **GIVEN** a loop step with `count: 10`, `entry: [A]`, `done: [C]`; closure is {A, B}; step B is a condition that returns `nextSteps: [out]` where `out` is not in the closure
- **WHEN** on the third iteration B returns `nextSteps: [out]`
- **THEN** the loop handler exits the loop immediately (early exit)
- **AND** the current iteration SHALL not run any further steps in the closure; the loop step completes with `nextSteps: [out]`; the executor continues with step `out`

### Requirement: Loop handler SHALL return subSteps for execution order (iteration markers + prefixed body steps)

The loop handler SHALL return **subSteps** on its StepResult for each iteration: for each round it SHALL append a marker step (e.g. `${step.id}.iteration_${i+1}`) and then each step result from the run with stepId prefixed (e.g. `${step.id}.iteration_${i+1}.${bodyStepId}`). Completion (done or early exit) SHALL be indicated via the loop step's result.log (e.g. "done, N iteration(s)" or "early exit after N iteration(s)"). The executor SHALL flatten subSteps into RunResult.steps so that a consumer that renders steps in array order sees the correct execution timeline.

#### Scenario: Loop with subSteps yields ordered flattened steps

- **GIVEN** a loop step with `count: 2`, `entry: [A]`, closure {A}
- **WHEN** the loop handler runs, calls context.run(subFlow, bodyCtx) twice, and returns StepResult with subSteps: marker `l1.iteration_1`, `l1.iteration_1.A`, marker `l1.iteration_2`, `l1.iteration_2.A`, and log "done, 2 iteration(s)"
- **THEN** RunResult.steps (after flattening) SHALL contain in order: marker (iteration_1), step A result (round 1), marker (iteration_2), step A result (round 2), then the loop step's own result
- **AND** a consumer that renders steps in array order SHALL see the correct execution timeline
