# step-context Specification

## Purpose

定義步驟間傳參：每一步執行時可讀取「執行時參數 + 前面所有步驟的輸出」作為當前 context；步驟產出的 outputs 以 **effective output key（step.outputKey 若存在則用，否則 step id）** 寫入 context（不攤平），方便對應節點。本 spec 涵蓋 StepResult.outputs、executor 累積 context、js 步驟讀取 params 與回傳 outputs、以及 context 上 runSubFlow 對 body step id 的驗證（不存在即回傳錯誤，避免靜默成功）。

## Requirements

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

The executor SHALL provide `runSubFlow(bodyStepIds, ctx)` on the step context so handlers (e.g. loop) can run a sub-graph of the current flow. When any element of `bodyStepIds` is not a step id in the current flow, the executor SHALL NOT run any of the requested steps; it SHALL return a result that includes an `error` (e.g. `Step(s) not found: <ids>`) so the calling handler can fail the step. The executor SHALL NOT silently succeed with zero steps run when some requested ids are missing, so that users get a clear error instead of believing the sub-flow completed successfully.

#### Scenario: runSubFlow with non-existent body id returns error

- **WHEN** a handler calls `runSubFlow(['nonexistent'], ctx)` and no step with id `nonexistent` exists in the flow
- **THEN** the executor SHALL return (e.g. in the promise result) an `error` indicating the missing step id(s)
- **AND** the handler SHALL be able to return a StepResult with success: false and that error, so the flow run fails with a clear message

### Requirement: StepContext SHALL provide optional appendLog for lifecycle log lines

StepContext SHALL include an optional `appendLog?: (message: string) => void`. When the executor invokes a handler's run(), it SHALL provide an appendLog that appends the given string to a buffer for the current step. When the handler returns, the executor SHALL merge that buffer with the returned result.log (e.g. accumulated lines first, then result.log if present) and set the final result.log so that MCP/CLI display shows the full lifecycle (e.g. loop start, iteration 1/N, ..., loop complete).

#### Scenario: Handler appends log during execution

- **WHEN** a handler calls `context.appendLog?.('start')` at the beginning, `context.appendLog?.('iteration 1/3')` and similar during execution, and `context.appendLog?.('complete')` before returning with `result.log = 'iterations: 3'`
- **THEN** the StepResult for that step SHALL have log equal to the concatenation of accumulated lines and the returned log (e.g. "start\niteration 1/3\niteration 2/3\niteration 3/3\ncomplete\niterations: 3" or equivalent)
- **AND** the formatter SHALL display that log so that lifecycle and final summary are both visible

### Requirement: runSubFlow body results SHALL be pushed immediately

When a handler invokes runSubFlow, the executor SHALL push each body step result to the main steps array as soon as that body step completes (immediate push). The caller step's own result SHALL be pushed when the handler returns, so it may appear after its body steps in the final steps order.

#### Scenario: Loop body steps appear in execution order before loop step

- **WHEN** a loop step runs and the body runs three iterations producing body step results R1, R2, R3
- **THEN** the main RunResult.steps SHALL contain R1, R2, R3 in that order, followed by the loop step's own result
- **AND** the loop step MAY use appendLog to record "loop start", "iteration 1/3", etc., and "loop complete" in its result.log

### Requirement: StepContext MAY provide pushMarkerStep for marker steps in execution order

StepContext SHALL include an optional `pushMarkerStep?: (stepId: string, log?: string) => void`. When the executor provides it, calling it SHALL append a marker step to the main RunResult.steps array with shape `{ stepId, success: true, ...(log !== undefined && { log }) }` (no outputs, no nextSteps). The executor SHALL provide the same steps array reference to both pushMarkerStep and runSubFlow so that markers and body step results appear in invocation order. Handlers (e.g. loop) MAY call pushMarkerStep at appropriate times so that GUI/Server/CLI can reconstruct the execution timeline from steps alone.

#### Scenario: pushMarkerStep appends marker to main steps in order

- **WHEN** a handler calls `context.pushMarkerStep?.('loop.iteration_1')`, then `context.runSubFlow(bodyIds, ctx)` which pushes body results, then `context.pushMarkerStep?.('loop.iteration_2')`
- **THEN** RunResult.steps SHALL contain in order: a step with stepId `loop.iteration_1` and success true, then the body step results from the first runSubFlow, then a step with stepId `loop.iteration_2`, then the next body results
- **AND** each marker step SHALL have success: true and no outputs or nextSteps

#### Scenario: pushMarkerStep absent when not provided by executor

- **WHEN** the executor does not set pushMarkerStep on context (e.g. in an environment where steps are not collected)
- **THEN** handlers that call `context.pushMarkerStep?.('id', log)` SHALL not throw and SHALL have no effect (optional chaining)

### Requirement: Command steps and outputs (reserved)

Command steps need not produce `outputs` in this change. The executor SHALL merge only `StepResult.outputs` when present; command steps may leave `outputs` undefined. Future extensions may define how command steps produce outputs (e.g. parsing stdout).

#### Scenario: Command step has no outputs

- **WHEN** a step is of type `command`
- **THEN** the executor does not set `outputs` on its `StepResult` for that step
- **AND** the context is not updated from that step's result (only js step outputs are merged in this spec)
