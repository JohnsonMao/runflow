# custom-node-registry Specification

## Purpose

定義統一節點介面與註冊機制：所有 step（含內建 command、js、http）均透過 StepHandler 介面執行；執行引擎僅依 Registry 分派；Parser 產出通用 step 結構；支援預設 registry 與呼叫端傳入自訂或擴充的 registry。

## Requirements

### Requirement: StepHandler interface SHALL be the single execution contract

The system SHALL define a single handler type `StepHandler` with signature `(step: FlowStep, context: StepContext) => Promise<StepResult>`. Every step type (including built-in command, js, http) MUST be executed by invoking the handler registered for that step's `type`. The engine SHALL NOT branch on step type with built-in logic; it SHALL only look up the handler in the registry and call it.

#### Scenario: Execution dispatches via registry

- **WHEN** a flow step has `type: 'command'` and the default registry is used
- **THEN** the executor looks up the handler for `'command'` in the registry and calls it with the step and context
- **AND** the returned `StepResult` is appended to the run result and outputs (if any) are merged into context for the next step

#### Scenario: Custom type is executed when registered

- **WHEN** the caller provides a registry that includes a handler for type `'myStep'` and a flow contains a step with `type: 'myStep'`
- **THEN** the executor calls that handler with the step and context
- **AND** the handler's returned `StepResult` is used the same way as built-in steps (outputs merged, success affects flow success)

### Requirement: StepContext SHALL provide params, previous outputs, and flowFilePath

`StepContext` MUST include at least: `params` (or equivalent merged view of initial params and previous step outputs), and `flowFilePath` (optional, for handlers that need to resolve file paths). The engine SHALL pass the same context shape to every handler so that built-in and custom handlers behave consistently.

#### Scenario: Handler receives previous outputs in context

- **WHEN** step A produced `outputs: { x: 1 }` and step B is about to run
- **THEN** the context passed to step B's handler SHALL include the merged view (e.g. `params.x === 1` or `previousOutputs` containing A's outputs)
- **AND** template substitution SHALL have been applied to the step by the executor before invoking the handler (so the handler receives a substituted snapshot)

### Requirement: StepResult contract SHALL be unchanged

Handlers MUST return a value that conforms to the existing `StepResult` shape: `stepId`, `success`, `stdout`, `stderr`, and optionally `error`, `outputs`. The engine SHALL merge `outputs` into context for the next step when present and when the result is used; flow-level success SHALL be false if any step's `success` is false.

#### Scenario: Handler returns StepResult with outputs

- **WHEN** a handler returns `{ stepId: 's1', success: true, stdout: '', stderr: '', outputs: { key: 'value' } }`
- **THEN** the engine merges `key: 'value'` into context for subsequent steps
- **AND** the next step's handler receives context that includes `key: 'value'`

### Requirement: Registry type and default registry SHALL be provided

The system SHALL define a registry type (e.g. `Record<string, StepHandler>` or `StepRegistry`) and SHALL provide `createDefaultRegistry()` that returns a registry containing handlers for `command`, `js`, and `http`. The engine SHALL use this default when `run(flow, options)` is called without a `registry` in options.

#### Scenario: Default registry includes built-in types

- **WHEN** `createDefaultRegistry()` is called
- **THEN** the returned registry SHALL contain entries for `'command'`, `'js'`, and `'http'`
- **AND** running a flow with only those step types without passing `registry` SHALL behave the same as passing that default registry

#### Scenario: Caller can override or extend registry

- **WHEN** the caller passes `registry` in `RunOptions` (e.g. by copying default and adding a handler, or by providing a full custom registry)
- **THEN** the engine SHALL use that registry for dispatch
- **AND** custom step types in the flow SHALL be executed if registered; unregistered types SHALL produce an error result per requirement below

### Requirement: Unregistered step type SHALL produce an error result

When a step's `type` is not present in the registry used for the run, the engine SHALL NOT throw. It SHALL produce a `StepResult` for that step with `success: false` and `error` set to a string that identifies the unknown type (e.g. "Unknown step type: xxx"). The flow's overall success SHALL be false.

#### Scenario: Unknown step type returns error result

- **WHEN** a flow contains a step with `type: 'unknownType'` and the registry has no handler for `'unknownType'`
- **THEN** the executor produces a StepResult for that step with `success: false` and `error` containing the type name
- **AND** the run continues to the next step (no exception thrown)
- **AND** the flow result has `success: false`

### Requirement: Handler exceptions SHALL be caught and converted to StepResult

If a registered handler throws (or rejects), the engine SHALL catch the exception and SHALL produce a `StepResult` for that step with `success: false` and `error` set to a string representation of the error. The flow SHALL NOT abort with an unhandled exception.

#### Scenario: Handler throws

- **WHEN** a handler throws or returns a rejected promise
- **THEN** the executor catches it and produces a StepResult with `success: false` and `error` set
- **AND** no outputs from that step are merged into context
- **AND** the flow result has `success: false`

### Requirement: FlowStep SHALL be a generic shape

`FlowStep` SHALL be defined as a generic object with at least `id: string` and `type: string`, and any additional keys (e.g. `[key: string]: unknown`) preserved for the handler. The parser SHALL produce this shape for every step; it SHALL NOT validate type-specific fields for built-in types (validation responsibility moves to handlers or optional schema).

#### Scenario: Parser accepts any string type

- **WHEN** YAML contains a step with `id: 's1'`, `type: 'custom'`, and extra keys `foo: 1`, `bar: 'x'`
- **THEN** the parser SHALL include a step object with `id: 's1'`, `type: 'custom'`, and the extra keys preserved
- **AND** the parser SHALL NOT return null solely because `type` is not one of command/js/http

#### Scenario: Parser requires id and type

- **WHEN** a step in YAML is missing `id` or `type`, or `type` is not a string
- **THEN** the parser SHALL return null (invalid flow) or otherwise reject the step

### Requirement: Substitution SHALL be applied by the executor before calling handler

Before invoking a step's handler, the executor SHALL apply template substitution to the step's string-valued fields using the current context (params and previous outputs). The handler SHALL receive the step object with substitution already applied so that handlers do not need to perform substitution themselves.

#### Scenario: Handler receives substituted step

- **WHEN** context has `base: 'https://api.example.com'` and the step has `url: '{{ base }}/users'`
- **THEN** the executor substitutes and passes to the handler a step with `url: 'https://api.example.com/users'`
- **AND** the handler may use the step as-is without calling substitute

### Requirement: CLI SHALL support loading custom handlers via config and --registry

The CLI SHALL support registering custom step handlers in addition to the default registry, by (1) **Config file**: when `--config` is given or a file `runflow.config.mjs` / `runflow.config.js` is found in cwd, the config's `handlers` property SHALL be a record mapping step type names to module paths (relative to the config file directory); the CLI SHALL load each module's default export (an `IStepHandler`) and merge it into the registry with `registerStepHandler`. (2) **--registry &lt;path&gt;**: the CLI SHALL load the given ESM module's default export (a `StepRegistry`) and merge each type→handler into the current registry. The final registry SHALL be the merge of default registry + config handlers (if any) + --registry module (if any).

#### Scenario: Custom handler from config is used in flow

- **WHEN** the user runs the CLI with a config file that has `handlers: { echo: './echo-handler.mjs' }` and the flow contains a step with `type: 'echo'`
- **THEN** the CLI builds a registry from default + loaded echo handler
- **AND** the step is executed by the echo handler and produces a StepResult like any built-in step

#### Scenario: Example custom-handler is provided

- **WHEN** the user consults the repository
- **THEN** an example under `examples/custom-handler` SHALL exist with a custom handler module (e.g. echo), a runflow config that registers it, and a flow YAML that uses the custom type
- **AND** the example README SHALL describe how to run the flow and the handler contract (IStepHandler: run, optional validate)
