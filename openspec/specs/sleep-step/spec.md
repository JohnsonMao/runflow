# sleep-step Specification

## Purpose

Step type `sleep`: delays execution for a configurable duration (seconds or milliseconds). Supports template substitution for the duration value. Produces no outputs; step succeeds after the delay.

## Requirements

### Requirement: Flows MUST support steps with type `sleep`

A flow step MUST be allowed to have `type: 'sleep'`. The engine MUST execute this step via the registered handler for `sleep`. The handler MUST wait for the specified duration then return a StepResult with `success: true` and no outputs. Parser SHALL accept any step with `id` and `type: 'sleep'` and optional duration fields as a generic step.

#### Scenario: Sleep with seconds

- **WHEN** a flow contains a step `{ id: 'wait', type: 'sleep', seconds: 1, dependsOn: [] }` and the default registry includes the sleep handler
- **THEN** the executor invokes the sleep handler; the handler waits 1 second and returns StepResult with success: true, no outputs
- **AND** the step is marked completed so dependents may run

#### Scenario: Sleep with ms

- **WHEN** a step has `type: 'sleep'` and `ms: 500` (and no seconds)
- **THEN** the handler SHALL wait 500 milliseconds and return success with no outputs

#### Scenario: Duration from context (template substitution)

- **WHEN** context has `delay: 2` and the sleep step has `seconds: "{{ delay }}"` (or equivalent after substitution)
- **THEN** the executor passes the step with substituted values; the handler SHALL wait the resolved duration (e.g. 2 seconds)
- **AND** the step completes successfully with no outputs

### Requirement: Sleep step SHALL require a duration

The sleep handler SHALL require either `seconds` (number) or `ms` (number) after substitution. If both are present, implementation MAY prefer one (e.g. seconds over ms). If neither is present or value is invalid, the handler SHALL return a StepResult with `success: false` and an error message.

#### Scenario: Missing duration

- **WHEN** a sleep step has no `seconds` and no `ms` (or both resolve to invalid values)
- **THEN** the handler returns StepResult with success: false and error describing the missing or invalid duration
