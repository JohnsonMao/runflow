# engine-step-when (delta)

## Purpose

Step-level skip condition: when a step has optional `when`, the executor evaluates it before running the step; if the expression is false, the step is skipped (not executed) and treated as success for DAG purposes.

## ADDED Requirements

### Requirement: Step MAY declare when for conditional execution

A flow step MAY include an optional `when` field (string). When present, the executor SHALL evaluate `when` as a JavaScript expression with current context (params) in scope before invoking the step handler. The expression SHALL be evaluated in a sandbox (e.g. runInNewContext) with only `params` available. If the result is falsy, the executor SHALL NOT run the step handler and SHALL record a StepResult with `success: true`, empty stdout/stderr, and no outputs; the step SHALL be considered completed so that dependent steps may run. If the result is truthy or `when` is absent, the executor SHALL run the step as usual.

#### Scenario: When evaluates to true, step runs

- **WHEN** a step has `when: "params.env === 'prod'"` and context has `env: 'prod'`
- **THEN** the executor evaluates the expression and gets true
- **AND** the executor invokes the step handler and records its StepResult as usual

#### Scenario: When evaluates to false, step is skipped

- **WHEN** a step has `when: "params.skip === true"` and context has `skip: true`
- **THEN** the executor evaluates the expression and gets true (skip)
- **AND** the executor does NOT invoke the step handler
- **AND** the executor pushes a StepResult with `success: true`, `stdout: ''`, `stderr: ''`, no `outputs`
- **AND** the step is marked completed so dependents are scheduled

#### Scenario: No when field, step runs

- **WHEN** a step has no `when` field
- **THEN** the executor runs the step handler and records its StepResult as usual

#### Scenario: When evaluation throws

- **WHEN** the `when` expression throws (e.g. syntax error or reference error)
- **THEN** the executor SHALL treat the result as truthy (run the step) so that flow does not silently skip; implementation MAY instead fail the step with an error
