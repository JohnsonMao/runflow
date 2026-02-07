# js-step-type Delta (add-custom-node-registry)

## MODIFIED Requirements

### Requirement: Flows MUST support steps with type `js` running JavaScript in-process

A flow step MUST be allowed to have `type: 'js'` and a `run` string (and optionally `file`) containing JavaScript code. The engine MUST execute this step via the **registered handler for `js`** (from the default or provided registry). The handler MUST run the code in-process and produce a `StepResult` with success/failure and optional stdout/stderr. Parser SHALL accept any step with `id` and `type: 'js'` as a generic step (id + type + remaining keys); validation of `run`/`file` is the responsibility of the js handler or optional schema—parser SHALL NOT return null solely because `run` is missing for type `js` (invalid steps may be rejected at run time by the handler).

#### Scenario: Valid js step runs successfully

- **WHEN** a flow contains a step `{ id: 's1', type: 'js', run: 'return 1 + 1' }` (or equivalent runnable code) and the default (or provided) registry includes the js handler
- **THEN** the executor invokes the js handler with the step and context
- **AND** the handler runs the code and returns a StepResult with `success: true`
- **AND** the step's result may include captured output if the implementation supports it (e.g. stdout from console.log)

#### Scenario: js step throws or returns a rejection

- **WHEN** a flow contains a js step whose code throws (e.g. `throw new Error('fail')`)
- **THEN** the js handler (or executor when catching handler rejection) marks the step as failed
- **AND** the step's `StepResult` has `success: false` and `error` set to a string representation of the error

#### Scenario: Parser accepts steps with type js as generic step

- **WHEN** YAML contains a step with `type: js` and optional `run` and/or `file` fields
- **THEN** the parser SHALL include a generic FlowStep (id, type, and remaining keys) in the flow steps
- **AND** type-specific validation (e.g. run required when file absent) is NOT required at parse time; the built-in js handler SHALL enforce input contract at run time and MAY produce an error StepResult for invalid step shape

#### Scenario: Flow can mix command and js steps

- **WHEN** a flow has steps of both `type: command` and `type: js`
- **THEN** the executor runs each step in order via the registry
- **AND** the run result contains one StepResult per step in the same order
