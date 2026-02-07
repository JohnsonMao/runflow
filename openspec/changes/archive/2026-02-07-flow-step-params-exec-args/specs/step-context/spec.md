# step-context Specification

## Purpose

定義步驟間傳參：每一步執行時可讀取「執行時參數 + 前面所有步驟的輸出」作為當前 context；步驟可產出 key-value 輸出，合併進 context 供後續步驟使用（後寫覆蓋）。本 spec 涵蓋 StepResult.outputs、executor 累積 context、以及 js 步驟讀取 params 與回傳 outputs。

## Requirements

### Requirement: StepResult MAY include outputs

A step's result MAY include an optional `outputs` field of type `Record<string, unknown>`. When a step produces structured output (e.g. a js step returns an object), that output SHALL be recorded on `StepResult.outputs` and merged into the context for subsequent steps.

#### Scenario: Step with outputs

- **WHEN** a step produces output (e.g. js step returns `{ x: 1 }`)
- **THEN** the corresponding `StepResult` has `outputs` set (e.g. `{ x: 1 }`)
- **AND** the next step's context includes those keys and values

#### Scenario: Step without outputs

- **WHEN** a step does not produce output (e.g. no return value or return is not a plain object)
- **THEN** the `StepResult` may omit `outputs` or have it undefined
- **AND** the context for the next step is unchanged by this step's output

### Requirement: Context SHALL accumulate across steps (later overwrites)

The executor SHALL maintain a single context object. Before each step, the step receives the current context (read-only for inputs). After each step, if the step's result has `outputs`, the executor SHALL merge it into the context with later-overwrites semantics: existing keys in `outputs` overwrite the same keys in the context.

#### Scenario: First step sees initial params only

- **WHEN** the flow is run with `params: { a: '1' }` and the first step is executed
- **THEN** the first step receives context `{ a: '1' }` (and no prior step outputs)

#### Scenario: Second step sees params and first step outputs

- **WHEN** the first step produced `outputs: { x: 'step1' }` and the second step is executed
- **THEN** the second step receives context `{ a: '1', x: 'step1' }` (params plus first step outputs)

#### Scenario: Later step overwrites same key

- **WHEN** step 1 produces `outputs: { k: 'v1' }` and step 2 produces `outputs: { k: 'v2' }`
- **THEN** step 3 receives context where `k` is `'v2'` (step 2 overwrites)

### Requirement: JS steps SHALL receive params and MAY return outputs

A js step MUST be executed with the current context available in the vm as a read-only object (e.g. `params`). The step's return value, if a plain object (and not null), SHALL be used as that step's `outputs` and merged into the context for the next step.

#### Scenario: JS step reads params

- **WHEN** a js step's code reads `params.a` and the initial context (or accumulated context) has `a: '1'`
- **THEN** the code sees `params.a === '1'`
- **AND** the step can use that value (e.g. in expressions or return)

#### Scenario: JS step returns object as outputs

- **WHEN** a js step's code is `return { out: params.a + '-suffix' }` and context has `a: '1'`
- **THEN** the step's `StepResult.outputs` is `{ out: '1-suffix' }` (or equivalent after serialization)
- **AND** the next step's context includes `out` with that value

#### Scenario: JS step returns non-object (no outputs)

- **WHEN** a js step's code returns a number or string or has no return
- **THEN** the step's `StepResult` does not set `outputs` (or outputs is undefined/empty)
- **AND** the context is not updated with that step's return value

#### Scenario: JS step sees prior step outputs in params

- **WHEN** step 1 returned `{ x: 'from-step1' }` and step 2 is a js step that reads `params.x`
- **THEN** step 2's code sees `params.x === 'from-step1'` (or the serialized form)
- **AND** step 2 can return further outputs to be merged for step 3

### Requirement: Command steps and outputs (reserved)

Command steps need not produce `outputs` in this change. The executor SHALL merge only `StepResult.outputs` when present; command steps may leave `outputs` undefined. Future extensions may define how command steps produce outputs (e.g. parsing stdout).

#### Scenario: Command step has no outputs

- **WHEN** a step is of type `command`
- **THEN** the executor does not set `outputs` on its `StepResult` for that step
- **AND** the context is not updated from that step's result (only js step outputs are merged in this spec)
