# step-context Specification (Delta)

## MODIFIED Requirements

### Requirement: StepResult SHALL support outputs

A step's result SHALL support an optional `outputs` field of type `Record<string, unknown>`. When a step produces structured output (via `return` or `context.report()`), that output SHALL be recorded on `StepResult.outputs` and written into context under the **effective output key** for that step.

#### Scenario: Step with outputs
- **WHEN** a step with `id: 's1'` produces output (e.g. `context.report({ outputs: { x: 1 } })`)
- **THEN** the corresponding `StepResult` has `outputs` set (e.g. `{ x: 1 }`)
- **AND** the executor SHALL set `context[effectiveKey] = outputs` where effectiveKey is `step.outputKey ?? step.id`, so the next step's context includes the output under that key

### Requirement: Context SHALL accumulate with step outputs namespaced by effective output key

The executor SHALL maintain a single context object where initial flow params remain at the top level. After each step, the executor SHALL assign `context[effectiveKey] = outputs` (or an empty object), where **effectiveKey** is the step's `outputKey` if present, otherwise its `id`. Step outputs SHALL NOT be merged flat; they MUST be namespaced by this effective key for downstream reference.

#### Scenario: Second step sees params and first step outputs under effective key
- **WHEN** the first step has `id: 'step1'` and produced `outputs: { x: 'step1' }`, and the second step is executed
- **THEN** the second step receives context `{ a: '1', step1: { x: 'step1' } }`

### Requirement: JS steps SHALL receive params and MAY return outputs

A js step MUST be executed with the current context available in the vm as a read-only object (e.g. `params`). The step's return value, if a plain object (and not null), SHALL be used as that step's `outputs` and merged into the context for the next step.

#### Scenario: JS step reads params
- **WHEN** a js step's code reads `params.a` and the initial context (or accumulated context) has `a: '1'`
- **THEN** the code sees `params.a === '1'`

### Requirement: context.run (RunFlowFn); handler SHALL validate body step ids when building sub-flow

The executor SHALL provide `run?: RunFlowFn` on the handler's execution context. Handlers running a sub-graph (e.g., loops) SHALL build a sub-flow from `context.steps` restricted to body ids and call `run` with that sub-flow. The engine will naturally stop when no more steps in the sub-flow's DAG are runnable.

#### Scenario: run with non-existent body id — handler validates before calling run
- **WHEN** a handler builds a sub-flow for body ids that include `nonexistent` and that id is not in `context.steps`
- **THEN** the handler SHALL return a result with success: false and an error indicating the missing step id(s)

### Requirement: StepContext provides run (RunFlowFn) for nested flows; no pushMarkerStep

The handler execution context SHALL include optional `run?: RunFlowFn` so handlers can run another flow. The loop handler SHALL use `run` and return `subSteps` on its result for execution order; the executor flattens these into `RunResult.steps`.

#### Scenario: Loop handler uses subSteps instead of pushMarkerStep
- **WHEN** a loop handler executes and wants to record sub-flow progress
- **THEN** it SHALL call `run` and collect results into `subSteps`
- **AND** it SHALL return those `subSteps` in its final result

### Requirement: HandlerContext SHALL NOT include utils

The `HandlerContext` passed to a handler's `run` function SHALL NOT include `utils`. Handlers SHALL access `utils` from the `FactoryContext` closure instead. This avoids duplication since `FactoryContext` already provides `utils` when the handler factory is invoked.

#### Scenario: Handler uses utils from factory closure
- **WHEN** a handler factory receives `{ defineHandler, z, utils }` from `FactoryContext`
- **THEN** the handler's `run` function SHALL access `utils` from the factory closure, not from `context.utils`
- **AND** `HandlerContext` SHALL NOT include a `utils` property
