# js-step-type (delta)

## Purpose

Add optional timeout (ms), output-key semantics for single key or object spread; support async code (Promise return). Handler awaits resolved value and applies same output rules.

## ADDED Requirements

### Requirement: JS step MAY declare timeout and output-key

A js step MAY include optional `timeout` (number, milliseconds; default 10000) and `output-key` (string; YAML `output-key` parsed as outputKey). When `timeout` is present and positive, the handler SHALL run the code with that execution time limit (e.g. via vm options); if the code does not complete within that time, the handler SHALL return StepResult with success: false and error indicating timeout. The key under which the step's return value is written to context SHALL be determined by `outputKey`: when present, that value is the key; when absent, the step's `id` is used. The handler SHALL always set `outputs[outputKey] = value` (where outputKey is step.outputKey or step.id), i.e. a single key holds the entire return or resolved value (whether plain object, primitive, or array). Downstream steps reference the result via `params[outputKey]` (e.g. `params.j1.x` when the value is an object).

#### Scenario: JS step with output-key and non-object return

- **WHEN** a js step has `id: 'j1'`, `output-key: 'total'`, `run: 'return 42'`
- **THEN** the handler runs the code and gets return value 42
- **AND** the handler returns StepResult with outputs: { total: 42 }
- **AND** the next step's context includes total: 42

#### Scenario: JS step without output-key returns object

- **WHEN** a js step has `id: 'j1'`, `run: 'return { a: 1, b: 2 }'` and no output-key
- **THEN** the handler returns StepResult with outputs: { j1: { a: 1, b: 2 } }
- **AND** the next step's context includes j1 with that object; e.g. params.j1.a === 1

#### Scenario: JS step with output-key and object return

- **WHEN** a js step has `output-key: 'result'`, `run: 'return { x: 1 }'`
- **THEN** the handler sets outputs: { result: { x: 1 } }
- **AND** the next step can reference params.result.x

#### Scenario: JS step exceeds timeout

- **WHEN** a js step has `timeout: 100`, `run: 'while(true){}'`
- **THEN** the handler runs the code with a 100 ms limit; the code does not complete in time
- **AND** the handler returns StepResult with success: false and error indicating timeout

### Requirement: JS step SHALL support async code

The js handler SHALL support JavaScript code that returns a Promise (e.g. async IIFE or explicit Promise). The handler SHALL await the Promise and SHALL use the resolved value (not the Promise itself) to set outputs[outputKey] with the same single-key rule as sync return. If the Promise rejects, the handler SHALL return StepResult with success: false and error set to the rejection reason.

#### Scenario: Async code returns resolved value

- **WHEN** a js step has `id: 'j1'`, `run: 'return (async () => { return { ok: true }; })()'` (or equivalent async code)
- **THEN** the handler awaits the Promise and gets { ok: true }
- **AND** the handler returns StepResult with success: true and outputs: { j1: { ok: true } }

#### Scenario: Async code rejects

- **WHEN** a js step has `run: 'return Promise.reject(new Error("async fail"))'`
- **THEN** the handler awaits the Promise and catches the rejection
- **AND** the handler returns StepResult with success: false and error containing "async fail"

#### Scenario: Async with output-key and primitive resolve

- **WHEN** a js step has `output-key: 'count'`, `run: 'return (async () => 3)()'`
- **THEN** the handler awaits and gets 3
- **AND** the handler returns StepResult with outputs: { count: 3 }
