# step-context — delta: loop-marker-steps

## ADDED Requirements

### Requirement: StepContext MAY provide pushMarkerStep for marker steps in execution order

StepContext SHALL include an optional `pushMarkerStep?: (stepId: string, log: string) => void`. When the executor provides it, calling it SHALL append a marker step to the main RunResult.steps array with shape `{ stepId, success: true, log }` (no outputs, no nextSteps). The executor SHALL provide the same steps array reference to both pushMarkerStep and runSubFlow so that markers and body step results appear in invocation order. Handlers (e.g. loop) MAY call pushMarkerStep at appropriate times to insert "loop start", "iteration i/N", "loop complete" between body steps so that GUI/Server/CLI can reconstruct the execution timeline from steps alone without parsing merged log.

#### Scenario: pushMarkerStep appends marker to main steps in order

- **WHEN** a handler calls `context.pushMarkerStep?.('loop._start', 'loop start')`, then `context.runSubFlow(bodyIds, ctx)` which pushes body results, then `context.pushMarkerStep?.('loop._iteration_1', 'iteration 1/2')`
- **THEN** RunResult.steps SHALL contain in order: a step with stepId `loop._start` and log "loop start", then the body step results from the first runSubFlow, then a step with stepId `loop._iteration_1` and log "iteration 1/2"
- **AND** each marker step SHALL have success: true and no outputs or nextSteps

#### Scenario: pushMarkerStep absent when not provided by executor

- **WHEN** the executor does not set pushMarkerStep on context (e.g. in an environment where steps are not collected)
- **THEN** handlers that call `context.pushMarkerStep?.('id', 'log')` SHALL not throw and SHALL have no effect (optional chaining)
