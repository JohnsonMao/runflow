# step-context Specification

## Purpose

定義步驟間傳參：每一步執行時可讀取「執行時參數 + 前面所有步驟的輸出」作為當前 context；步驟產出的 outputs 以 **step id 為 key** 寫入 context（不攤平），方便對應節點。本 spec 涵蓋 StepResult.outputs、executor 累積 context、js 步驟讀取 params 與回傳 outputs、以及 context 上 runSubFlow 對 body step id 的驗證（不存在即回傳錯誤，避免靜默成功）。

## Requirements

### Requirement: StepResult MAY include outputs

A step's result MAY include an optional `outputs` field of type `Record<string, unknown>`. When a step produces structured output (e.g. a js step returns an object), that output SHALL be recorded on `StepResult.outputs` and written into context under that step's id for subsequent steps.

#### Scenario: Step with outputs

- **WHEN** a step with `id: 's1'` produces output (e.g. returns `{ x: 1 }`)
- **THEN** the corresponding `StepResult` has `outputs` set (e.g. `{ x: 1 }`)
- **AND** the executor SHALL set `context['s1'] = outputs` (or equivalent) so the next step's context includes `context.s1.x === 1`

#### Scenario: Step without outputs

- **WHEN** a step does not produce output (e.g. no return value or return is not a plain object)
- **THEN** the `StepResult` may omit `outputs` or have it undefined
- **AND** the executor SHALL set `context[stepId] = {}` for that step so the step id key exists; the context for the next step is otherwise unchanged

### Requirement: Context SHALL accumulate with step outputs namespaced by step id

The executor SHALL maintain a single context object. Initial flow params SHALL remain at the top level (e.g. `context.a`, `context.title`). After each step, if the step's result has `outputs`, the executor SHALL assign `context[stepId] = outputs` (or empty object when outputs is absent). Step outputs SHALL NOT be merged flat into context; they SHALL be namespaced by step id so that downstream steps and templates reference them as `{{ stepId.field }}` (e.g. `{{ init.count }}`, `{{ req.body }}`).

#### Scenario: First step sees initial params only

- **WHEN** the flow is run with `params: { a: '1' }` and the first step is executed
- **THEN** the first step receives context `{ a: '1' }` (and no prior step outputs)

#### Scenario: Second step sees params and first step outputs under step id

- **WHEN** the first step has `id: 'step1'` and produced `outputs: { x: 'step1' }`, and the second step is executed
- **THEN** the second step receives context `{ a: '1', step1: { x: 'step1' } }` (params at top level; step1's outputs under `context.step1`)

#### Scenario: Each step's outputs under its own id

- **WHEN** step 1 (`id: 's1'`) produces `outputs: { k: 'v1' }` and step 2 (`id: 's2'`) produces `outputs: { k: 'v2' }`
- **THEN** step 3 receives context with `context.s1.k === 'v1'` and `context.s2.k === 'v2'` (no overwrite between steps; template `{{ s1.k }}` vs `{{ s2.k }}`)

### Requirement: JS steps SHALL receive params and MAY return outputs

A js step MUST be executed with the current context available in the vm as a read-only object (e.g. `params`). The step's return value, if a plain object (and not null), SHALL be used as that step's `outputs` and merged into the context for the next step.

#### Scenario: JS step reads params

- **WHEN** a js step's code reads `params.a` and the initial context (or accumulated context) has `a: '1'`
- **THEN** the code sees `params.a === '1'`
- **AND** the step can use that value (e.g. in expressions or return)

#### Scenario: JS step returns object as outputs

- **WHEN** a js step with `id: 'myStep'` has code `return { out: params.a + '-suffix' }` and context has `a: '1'`
- **THEN** the step's `StepResult.outputs` is `{ out: '1-suffix' }` (or equivalent after serialization)
- **AND** the next step's context includes `context.myStep.out` with that value (namespaced by step id)

#### Scenario: JS step returns non-object (no outputs)

- **WHEN** a js step's code returns a number or string or has no return
- **THEN** the step's `StepResult` does not set `outputs` (or outputs is undefined/empty)
- **AND** the context is not updated with that step's return value

#### Scenario: JS step sees prior step outputs in params under step id

- **WHEN** step 1 has `id: 'step1'` and returned `{ x: 'from-step1' }`, and step 2 is a js step that reads `params.step1.x`
- **THEN** step 2's code sees `params.step1.x === 'from-step1'` (outputs namespaced by step id)
- **AND** step 2 can return further outputs; the executor will set `context.step2 = step2Outputs` for step 3

### Requirement: runSubFlow SHALL validate body step ids

The executor SHALL provide `runSubFlow(bodyStepIds, ctx, callerStepId?)` on the step context so handlers (e.g. loop) can run a sub-graph of the current flow. When any element of `bodyStepIds` is not a step id in the current flow, the executor SHALL NOT run any of the requested steps; it SHALL return a result that includes an `error` (e.g. `Step(s) not found: <ids>`) so the calling handler can fail the step. The executor SHALL NOT silently succeed with zero steps run when some requested ids are missing, so that users get a clear error instead of believing the sub-flow completed successfully.

#### Scenario: runSubFlow with non-existent body id returns error

- **WHEN** a handler calls `runSubFlow(['nonexistent'], ctx)` and no step with id `nonexistent` exists in the flow
- **THEN** the executor SHALL return (e.g. in the promise result) an `error` indicating the missing step id(s)
- **AND** the handler SHALL be able to return a StepResult with success: false and that error, so the flow run fails with a clear message

### Requirement: Command steps and outputs (reserved)

Command steps need not produce `outputs` in this change. The executor SHALL merge only `StepResult.outputs` when present; command steps may leave `outputs` undefined. Future extensions may define how command steps produce outputs (e.g. parsing stdout).

#### Scenario: Command step has no outputs

- **WHEN** a step is of type `command`
- **THEN** the executor does not set `outputs` on its `StepResult` for that step
- **AND** the context is not updated from that step's result (only js step outputs are merged in this spec)
