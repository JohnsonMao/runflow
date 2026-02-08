# engine-step-retry Specification

## Purpose

Step-level retry: when a step has optional `retry` (number), the executor retries the step on failure up to that many additional attempts before recording failure.

## Requirements

### Requirement: Step MAY declare retry count

A flow step MAY include an optional `retry` field (non-negative number). When present, the executor SHALL attempt to run the step up to `(retry + 1)` times (initial run plus retry attempts). If a run returns a StepResult with `success: true`, the executor SHALL record that result and SHALL NOT retry. If a run returns `success: false` or throws, the executor SHALL retry until the total attempts reach `retry + 1`; after the last attempt, the executor SHALL record the last StepResult (failed). When `retry` is absent or zero, the step runs once with no retry.

#### Scenario: Step succeeds on first run

- **WHEN** a step has `retry: 2` and the handler returns success on the first run
- **THEN** the executor records that result and does not retry
- **AND** only one handler invocation occurs

#### Scenario: Step fails then succeeds on retry

- **WHEN** a step has `retry: 2` and the handler returns success: false on the first run and success: true on the second run
- **THEN** the executor records the second (success) result
- **AND** the step is marked as successful

#### Scenario: Step fails all attempts

- **WHEN** a step has `retry: 1` and the handler returns success: false on both runs
- **THEN** the executor records the last (failed) StepResult
- **AND** the step is marked as failed
- **AND** the flow's overall success reflects the failure

#### Scenario: No retry field

- **WHEN** a step has no `retry` field or retry is zero
- **THEN** the executor runs the step once; no retries on failure
