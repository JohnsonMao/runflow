# js-step-type Specification

## Purpose

定義 flow 支援步驟型別 `js`：以字串 `run` 承載 JavaScript，在引擎同 process 內執行，產出與 command 步驟相同的 `StepResult`（success/stdout/stderr），並可與 command 步驟混用。

## Requirements

### Requirement: Flows MUST support steps with type `js` running JavaScript in-process

A flow step MUST be allowed to have `type: 'js'` and a `run` string containing JavaScript code. The engine MUST execute this code in-process (within the same Node process) and produce a `StepResult` with success/failure and optional stdout/stderr.

#### Scenario: Valid js step runs successfully

- **WHEN** a flow contains a step `{ id: 's1', type: 'js', run: 'return 1 + 1' }` (or equivalent runnable code)
- **THEN** the executor runs the code and marks the step as successful
- **AND** the step's `StepResult` has `success: true`
- **AND** the step's result may include captured output if the implementation supports it (e.g. stdout from console.log)

#### Scenario: js step throws or returns a rejection

- **WHEN** a flow contains a js step whose code throws (e.g. `throw new Error('fail')`)
- **THEN** the executor catches the error and marks the step as failed
- **AND** the step's `StepResult` has `success: false` and `error` set to a string representation of the error

#### Scenario: Parser accepts and validates js steps

- **WHEN** YAML contains a step with `type: js` and a string `run` field
- **THEN** the parser includes a `FlowStepJs` in the flow steps
- **AND** if `type` is `js` but `run` is missing or not a string, the parser returns null (invalid flow)

#### Scenario: Flow can mix command and js steps

- **WHEN** a flow has steps of both `type: command` and `type: js`
- **THEN** the executor runs each step in order according to its type
- **AND** the run result contains one StepResult per step in the same order
