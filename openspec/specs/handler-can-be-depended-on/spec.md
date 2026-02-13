# handler-can-be-depended-on Specification

## Purpose

定義 step handler 可選方法 **getAllowedDependentIds**：當 handler 實作此方法時，僅允許回傳的 step id 出現在其他 step 的 `dependsOn` 裡指向該 step；引擎在執行前驗證「誰可以依賴此 step」，違規時提早報錯並指出 step id。

## Requirements

### Requirement: IStepHandler MAY implement getAllowedDependentIds

The handler interface SHALL support an optional method `getAllowedDependentIds?: (step: FlowStep) => string[]`. When omitted, any step MAY list this step's id in their `dependsOn`. When present, only step ids returned by `getAllowedDependentIds(step)` MAY list this step's id in their `dependsOn`; the engine SHALL validate before run and SHALL fail with a clear error listing violating step ids.

#### Scenario: Handler without getAllowedDependentIds allows any dependent

- **GIVEN** a handler for type `'set'` that does not implement `getAllowedDependentIds`
- **WHEN** a flow has step A (`type: set`) and step B with `dependsOn: [A]`
- **THEN** validation SHALL pass and the flow SHALL run as today

#### Scenario: Condition step allows only then/else steps to depend on it

- **GIVEN** a handler for type `'condition'` that implements `getAllowedDependentIds(step)` returning `step.then` and `step.else` ids, and a step `cond` with `then: [thenStep]`, `else: [elseStep]`
- **WHEN** a flow has `thenStep` with `dependsOn: [cond]` and `elseStep` with `dependsOn: [cond]`
- **THEN** validation SHALL pass
- **WHEN** a flow has a step `other` with `dependsOn: [cond]` and `other` is not in the set returned by `getAllowedDependentIds(cond)`
- **THEN** validation SHALL fail with an error that includes the violating step id (e.g. `other`)

#### Scenario: Loop step allows only entry and done steps to depend on it

- **GIVEN** a handler for type `'loop'` that implements `getAllowedDependentIds(step)` returning `step.entry` and `step.done` (and `step.end` if present) ids, and a step `loop` with `entry: [loopBody]`, `done: [nap]`
- **WHEN** a flow has `loopBody` with `dependsOn: [loop]` and `nap` with `dependsOn: [loop]`
- **THEN** validation SHALL pass
- **WHEN** a flow has a step `other` with `dependsOn: [loop]` and `other` is not in the set returned by `getAllowedDependentIds(loop)`
- **THEN** validation SHALL fail with an error that includes the violating step id (e.g. `other`)

### Requirement: Allowed dependents SHALL be provided by handler

For a step whose handler implements `getAllowedDependentIds`, the set of step ids that MAY have `dependsOn` including this step's id SHALL be exactly the array returned by `getAllowedDependentIds(step)`. The engine SHALL NOT interpret step shape (then/else, entry/done) in core; the handler owns this logic. Steps not in this set that list this step in their `dependsOn` SHALL cause validation to fail.

#### Scenario: Validation runs before execution

- **WHEN** the engine runs (or dry-runs) a flow and a step has a handler that implements `getAllowedDependentIds`
- **THEN** the engine SHALL perform this validation after DAG build and before executing any step
- **AND** on validation failure the engine SHALL return a failed result (or throw) with a message that includes at least one violating step id

### Requirement: Scheduling and nextSteps SHALL remain unchanged

This change SHALL NOT alter getRunnable, nextSteps, or completedStepIds. Then/else and entry/done steps SHALL continue to use `dependsOn: [designator]` in YAML; only the additional validation rule is added.

#### Scenario: No change to DAG or execution order

- **GIVEN** a valid flow with condition or loop steps and designated dependents
- **WHEN** validation passes
- **THEN** execution order and getRunnable/nextSteps behavior SHALL be unchanged from before this change
