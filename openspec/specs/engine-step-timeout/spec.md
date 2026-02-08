# engine-step-timeout Specification

## Purpose

Step-level execution timeout: when a step has optional `timeout` (seconds), the executor enforces a maximum duration for that step's execution; if exceeded, the step fails.

## Requirements

### Requirement: Step MAY declare timeout in seconds

A flow step MAY include an optional `timeout` field (number, in seconds). When present and greater than zero, the executor SHALL run the step handler within that duration. If the handler does not complete before the timeout, the executor SHALL treat the step as failed and SHALL record a StepResult with `success: false` and `error` set to a string indicating timeout (e.g. "step timeout after Ns"). The executor SHALL use a timeout mechanism (e.g. Promise.race) that does not require handler cooperation.

#### Scenario: Step completes within timeout

- **WHEN** a step has `timeout: 10` and the handler completes within 10 seconds
- **THEN** the executor records the handler's StepResult as usual
- **AND** no timeout error is produced

#### Scenario: Step exceeds timeout

- **WHEN** a step has `timeout: 1` and the handler does not complete within 1 second
- **THEN** the executor SHALL record a StepResult with `success: false` and `error` containing a timeout message
- **AND** the step is marked completed (failed) so the flow can proceed or fail overall

#### Scenario: No timeout field

- **WHEN** a step has no `timeout` field or timeout is not a positive number
- **THEN** the executor runs the step with no time limit (subject to any handler-internal limits)
