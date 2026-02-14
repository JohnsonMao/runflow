# step-context (delta)

## ADDED Requirements

### Requirement: FlowStep MAY declare optional outputKey (engine-reserved)

A step in the flow definition MAY include an optional engine-reserved field: `outputKey` (string). The executor SHALL use it only for context keying. When present, `outputKey` SHALL be the key under which the step's outputs are written to context; when absent, the step's `id` SHALL be used as the key.

#### Scenario: Step with outputKey writes to that key

- **WHEN** a step has `id: 's1'` and `outputKey: 'api'` and produces `outputs: { x: 1 }`
- **THEN** the executor SHALL set `context['api'] = outputs` (i.e. `context.api.x === 1`)
- **AND** downstream steps reference `params.api.x`, not `params.s1.x`

#### Scenario: Step without outputKey uses id as key

- **WHEN** a step has `id: 's1'` and no `outputKey` and produces `outputs: { x: 1 }`
- **THEN** the executor SHALL set `context['s1'] = outputs` as before
- **AND** downstream steps reference `params.s1.x`

## MODIFIED Requirements

### Requirement: StepResult MAY include outputs

A step's result MAY include an optional `outputs` field of type `Record<string, unknown>`. When a step produces structured output (e.g. a js step returns an object), that output SHALL be recorded on `StepResult.outputs` and written into context under the **effective output key** for that step (the step's `outputKey` when present, otherwise the step's `id`) for subsequent steps.

#### Scenario: Step with outputs

- **WHEN** a step with `id: 's1'` produces output (e.g. returns `{ x: 1 }`)
- **THEN** the corresponding `StepResult` has `outputs` set (e.g. `{ x: 1 }`)
- **AND** the executor SHALL set `context[effectiveKey] = outputs` where effectiveKey is `step.outputKey ?? step.id`, so the next step's context includes the output under that key (e.g. `context.s1.x === 1` when outputKey is absent)

#### Scenario: Step without outputs

- **WHEN** a step does not produce output (e.g. no return value or return is not a plain object)
- **THEN** the `StepResult` may omit `outputs` or have it undefined
- **AND** the executor SHALL set `context[effectiveKey] = {}` for that step so the effective key exists; the context for the next step is otherwise unchanged

### Requirement: Context SHALL accumulate with step outputs namespaced by effective output key

The executor SHALL maintain a single context object. Initial flow params SHALL remain at the top level (e.g. `context.a`, `context.title`). After each step, if the step's result has `outputs`, the executor SHALL assign `context[effectiveKey] = outputs` (or empty object when outputs is absent), where **effectiveKey** is the step's `outputKey` when present and a non-empty string, otherwise the step's `id`. Step outputs SHALL NOT be merged flat into context; they SHALL be namespaced by this effective key so that downstream steps and templates reference them as `{{ effectiveKey.field }}` (e.g. `{{ init.count }}`, `{{ api.body }}`).

#### Scenario: First step sees initial params only

- **WHEN** the flow is run with `params: { a: '1' }` and the first step is executed
- **THEN** the first step receives context `{ a: '1' }` (and no prior step outputs)

#### Scenario: Second step sees params and first step outputs under effective key

- **WHEN** the first step has `id: 'step1'` and produced `outputs: { x: 'step1' }`, and the second step is executed
- **THEN** the second step receives context `{ a: '1', step1: { x: 'step1' } }` (params at top level; step1's outputs under `context.step1`, or under `context[step1.outputKey]` if outputKey is set)

#### Scenario: Each step's outputs under its own effective key

- **WHEN** step 1 (`id: 's1'`) produces `outputs: { k: 'v1' }` and step 2 (`id: 's2'`) produces `outputs: { k: 'v2' }`
- **THEN** step 3 receives context with the first step's outputs under its effective key and the second under its effective key (no overwrite between steps; template `{{ s1.k }}` vs `{{ s2.k }}` when outputKey is absent for both)
