## ADDED Requirements

### Requirement: Engine SHALL return unconsumed nextSteps in RunResult

When `executeFlow` runs a flow, it SHALL collect any `nextSteps` returned by steps that do not target any step within the current `FlowDefinition`. These SHALL be returned as `unconsumedNextSteps` in the `RunResult`.

#### Scenario: Sub-flow returns unconsumed nextSteps

- **GIVEN** a FlowDefinition with steps {A, B} where B returns `nextSteps: [C]` and C is not in {A, B}
- **WHEN** `executeFlow` is called with this FlowDefinition
- **THEN** it SHALL execute A and B
- **AND** it SHALL return `RunResult` with `unconsumedNextSteps: [C]`

### Requirement: Step handler SHALL be able to execute nested flows via StepContext.run

The `StepContext` provided to step handlers SHALL include a `run` function that allows the handler to execute a `FlowDefinition` within the current environment. This enables "container" steps (like `loop`, `condition`, `flow call`) to manage their own sub-DAGs.

#### Scenario: Handler executes nested flow

- **GIVEN** a custom step handler that wants to run a sub-flow
- **WHEN** the handler calls `context.run(subFlow, params)`
- **THEN** the engine SHALL execute the sub-flow and return its `RunResult` to the handler
- **AND** the handler SHALL be able to use the sub-flow's outputs and `unconsumedNextSteps` to determine its own result

### Requirement: Engine SHALL NOT use scope-based early exit

The engine SHALL NOT use `scopeStepIds` or an internal `earlyExit` flag to terminate execution of a flow based on `nextSteps`. It SHALL continue execution as long as there are runnable steps within the provided `FlowDefinition`. Termination logic based on control leaving a sub-flow SHALL be the responsibility of the calling handler.

#### Scenario: Engine runs until DAG sinks or no runnable steps

- **GIVEN** a flow with steps {A, B} where B points to {C} (not in the flow)
- **WHEN** `executeFlow` is called
- **THEN** it SHALL run A and B to completion
- **AND** it SHALL NOT stop early just because B points outside the flow
- **AND** it SHALL return B's nextSteps as `unconsumedNextSteps`
