# loop-step — delta: loop-marker-steps

## ADDED Requirements

### Requirement: Loop handler MAY push marker steps between body iterations for timeline display

When the executor provides `context.pushMarkerStep`, the loop handler MAY call it so that RunResult.steps reflects execution order with markers between body steps. The handler SHALL push a "loop start" marker before the first runSubFlow, SHALL push an "iteration i/N" marker after each runSubFlow (when the round completes without early exit), and MAY push a "loop complete" marker before returning the loop step result. Marker stepIds SHALL be chosen so they do not collide with flow step ids (e.g. `${step.id}._start`, `${step.id}._iteration_${i}`). The resulting steps order SHALL be: loop start → body round 1 → iteration 1/N → body round 2 → … → loop complete (optional) → loop step result.

#### Scenario: Loop with marker steps yields ordered steps

- **GIVEN** a loop step with `count: 2`, `entry: [A]`, closure {A}; executor provides pushMarkerStep
- **WHEN** the loop handler runs and pushes "loop start", runs runSubFlow (round 1), pushes "iteration 1/2", runs runSubFlow (round 2), pushes "iteration 2/2", pushes "loop complete", then returns StepResult
- **THEN** RunResult.steps SHALL contain in order: marker (loop start), step A result (round 1), marker (iteration 1/2), step A result (round 2), marker (iteration 2/2), marker (loop complete) if pushed, then the loop step's own result
- **AND** a consumer that renders steps in array order SHALL see the correct execution timeline without parsing the loop step's log

#### Scenario: Loop without pushMarkerStep behaves unchanged

- **WHEN** the executor does not provide pushMarkerStep (or handler does not call it)
- **THEN** RunResult.steps SHALL contain body step results in execution order followed by the loop step result, as before this change
- **AND** the loop step MAY still use appendLog for "loop start", "iteration i/N", "loop complete" in its result.log
