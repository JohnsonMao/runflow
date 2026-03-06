# engine-early-termination Specification

## ADDED Requirements

### Requirement: FlowStep SHALL support continueOnError
A flow step SHALL optionally declare a `continueOnError` boolean field. When set to `true`, the engine SHALL proceed to subsequent steps even if this step fails (success is `false`). The default value SHALL be `false`.

#### Scenario: Step fails with continueOnError true
- **WHEN** a step with `continueOnError: true` fails (returns `success: false`)
- **THEN** the engine SHALL continue to execute subsequent waves that depend on this step (if any) or are independent
- **AND** the overall flow success SHALL reflect this failure by being `false`

#### Scenario: Step fails with continueOnError false (default)
- **WHEN** a step with `continueOnError: false` (or omitted) fails
- **THEN** the engine SHALL stop executing any subsequent steps in the DAG
- **AND** the engine SHALL return the current accumulated results immediately

### Requirement: RunOptions SHALL support continueOnError
The engine execution options (RunOptions) SHALL include a global `continueOnError` boolean field. This value SHALL serve as the default for all steps in the flow unless overridden by the step's own `continueOnError` field.

#### Scenario: Global continueOnError is true
- **WHEN** RunOptions has `continueOnError: true`
- **AND** a step without its own `continueOnError` setting fails
- **THEN** the engine SHALL continue execution of the flow

#### Scenario: Step override of global continueOnError
- **WHEN** RunOptions has `continueOnError: true`
- **AND** a step has `continueOnError: false` and fails
- **THEN** the engine SHALL stop execution, as the step-level setting takes precedence
