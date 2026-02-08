# set-step Specification

## Purpose

Step type `set`: declaratively writes key-value pairs into context. The step's `set` object is merged into context after template substitution (performed by the executor before calling the handler). No script execution; the handler returns outputs equal to the (already substituted) set object.

## ADDED Requirements

### Requirement: Flows MUST support steps with type `set`

A flow step MUST be allowed to have `type: 'set'` and a required `set` field (object). The engine MUST execute this step via the registered handler for `set`. Before invoking the handler, the executor SHALL apply template substitution to the step (including nested values in `set`). The handler SHALL return a StepResult with `success: true` and `outputs` set to the step's substituted `set` object, so that those keys are merged into context. Parser SHALL accept any step with `id`, `type: 'set'`, and `set` as a generic step.

#### Scenario: Set single key from literal

- **WHEN** a flow contains a step `{ id: 's1', type: 'set', set: { flag: true }, dependsOn: [] }`
- **THEN** the executor substitutes the step (no placeholders) and invokes the set handler
- **AND** the handler returns outputs: { flag: true }; context for the next step includes flag: true

#### Scenario: Set key from context (template)

- **WHEN** context has `a: 1`, `b: 2` and the set step has `set: { sum: "{{ a }}+{{ b }}" }` (or a template that resolves to a value)
- **THEN** the executor substitutes the step so that set values use context; the handler returns outputs equal to the substituted set
- **AND** the next step's context includes the set keys with substituted values

#### Scenario: Set step has no set field

- **WHEN** a set step has no `set` field or set is not an object
- **THEN** the handler SHALL return StepResult with success: false and an error message, or outputs SHALL be empty (implementation may define)

### Requirement: Set step output SHALL be merged like other steps

The outputs returned by the set handler SHALL be merged into context with the same later-overwrites semantics as other step types (step-context). Downstream steps SHALL see the set keys in their params.

#### Scenario: Downstream sees set values

- **WHEN** a set step returns outputs: { x: 10 } and a subsequent step has dependsOn including that set step
- **THEN** the subsequent step's context (params) SHALL include x: 10
- **AND** template substitution in that step can use `{{ x }}`
