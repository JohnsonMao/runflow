# engine-step-when Specification

## Purpose

Step-level skip condition: when a step has optional `skip`, the executor evaluates it before running the step; if the expression is truthy, the step is skipped (not executed) and treated as success for DAG purposes.

**Note:** The field name is `skip` (expression is "truthy → skip"). The name `when` is **deprecated** and SHALL NOT be used in new flows; implementations may support `when` for backward compatibility by treating it as equivalent to `skip`.

## Requirements

### Requirement: Step MAY declare skip for conditional execution

A flow step MAY include an optional `skip` field (string). When present, the executor SHALL evaluate `skip` as a JavaScript expression with current context (params) in scope before invoking the step handler. The expression SHALL be evaluated in a sandbox with only params available. If the result is **truthy**, the executor SHALL NOT run the step handler and SHALL record a StepResult with `success: true`, empty stdout/stderr, and no outputs; the step SHALL be considered completed so that dependent steps may run. If the result is falsy or `skip` is absent, the executor SHALL run the step as usual.

#### Scenario: Skip evaluates to false, step runs

- **WHEN** a step has `skip: "params.skipIt"` and context has `skipIt: false`
- **THEN** the executor evaluates the expression and gets false
- **AND** the executor invokes the step handler and records its StepResult as usual

#### Scenario: Skip evaluates to true, step is skipped

- **WHEN** a step has `skip: "params.skip === true"` and context has `skip: true`
- **THEN** the executor evaluates the expression and gets true (skip)
- **AND** the executor does NOT invoke the step handler
- **AND** the executor pushes a StepResult with `success: true`, `stdout: ''`, `stderr: ''`, no `outputs`
- **AND** the step is marked completed so dependents are scheduled

#### Scenario: No skip field, step runs

- **WHEN** a step has no `skip` field
- **THEN** the executor runs the step handler and records its StepResult as usual

#### Scenario: Skip evaluation throws

- **WHEN** the `skip` expression throws (e.g. syntax error or reference error)
- **THEN** the executor SHALL treat the result as falsy (run the step) so that flow does not silently skip; implementation MAY instead fail the step with an error
