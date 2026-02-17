# custom-node-registry Specification

## Purpose

定義統一節點介面與註冊機制：所有 step 均透過 StepHandler 介面執行；執行引擎僅依 Registry 分派；Parser 產出通用 step 結構。Registry 由呼叫端建立並傳入（內建 handler 來自 `@runflow/handlers`）；引擎不提供預設 registry。

## Requirements

### Requirement: StepHandler interface SHALL be the single execution contract

The system SHALL define a single handler type `StepHandler` with signature `(step: FlowStep, context: StepContext) => Promise<StepResult>`. Every step type (including built-in and custom) MUST be executed by invoking the handler registered for that step's `type`. The engine SHALL NOT branch on step type with built-in logic; it SHALL only look up the handler in the registry and call it.

#### Scenario: Execution dispatches via registry

- **WHEN** a flow step has `type: 'http'` and the caller-provided registry is used
- **THEN** the executor looks up the handler for `'http'` in the registry and calls it with the step and context
- **AND** the returned `StepResult` is appended to the run result and outputs (if any) are written into context under the step id for the next step (see step-context: namespaced by step id)

#### Scenario: Custom type is executed when registered

- **WHEN** the caller provides a registry that includes a handler for type `'myStep'` and a flow contains a step with `type: 'myStep'`
- **THEN** the executor calls that handler with the step and context
- **AND** the handler's returned `StepResult` is used the same way as built-in steps (outputs namespaced by step id in context, success affects flow success)

### Requirement: StepContext SHALL provide params, previous outputs, and flowFilePath

`StepContext` MUST include at least: `params` (or equivalent merged view of initial params and previous step outputs), and `flowFilePath` (optional, for handlers that need to resolve file paths). The engine SHALL pass the same context shape to every handler so that built-in and custom handlers behave consistently.

#### Scenario: Handler receives previous outputs in context under step id

- **WHEN** step A with `id: 'a'` produced `outputs: { x: 1 }` and step B is about to run
- **THEN** the context passed to step B's handler SHALL include `params.a.x === 1` (A's outputs under `params.a`; initial params remain at top level)
- **AND** template substitution SHALL have been applied to the step by the executor before invoking the handler (so the handler receives a substituted snapshot)

### Requirement: StepResult contract SHALL be unchanged

Handlers MUST return a value that conforms to the existing `StepResult` shape: `stepId`, `success`, `stdout`, `stderr`, and optionally `error`, `outputs`. The engine SHALL assign `context[stepId] = outputs` (or `{}` when absent) for the next step when the result is used; flow-level success SHALL be false if any step's `success` is false. See step-context for namespaced accumulation.

#### Scenario: Handler returns StepResult with outputs

- **WHEN** a handler returns `{ stepId: 's1', success: true, stdout: '', stderr: '', outputs: { key: 'value' } }`
- **THEN** the engine sets `context.s1 = { key: 'value' }` for subsequent steps (outputs namespaced by step id)
- **AND** the next step's handler receives context that includes `params.s1.key === 'value'`

### Requirement: Engine SHALL NOT provide a default registry; registry SHALL be required when flow has steps

The system SHALL define a registry type (e.g. `StepRegistry`) and SHALL export `registerStepHandler(registry, type, handler)` so that callers can build a registry. The engine SHALL NOT provide a default registry or `createDefaultRegistry`. When the flow has steps to execute, `run(flow, options)` SHALL require a valid `registry` in `RunOptions`; if `registry` is missing, the engine SHALL fail fast (e.g. throw or return a failed result with a clear message such as "registry is required"). Callers that need built-in step types SHALL depend on `@runflow/handlers` and use a helper (e.g. `createBuiltinRegistry()` or `registerBuiltinHandlers(registry)`), then pass that registry to `run()`.

#### Scenario: Run without registry fails or is invalid

- **WHEN** the caller invokes `run(flow, {})` with no `registry` and the flow has at least one step
- **THEN** the engine SHALL require `registry` (e.g. throw or return a failed result with a message like "registry is required")
- **AND** there SHALL be no implicit default registry from core

#### Scenario: Caller builds registry from handlers package and runs

- **WHEN** the caller does `const registry = createBuiltinRegistry()` from `@runflow/handlers`, then `run(flow, { registry })`
- **THEN** the executor uses that registry for dispatch
- **AND** built-in step types behave as before

#### Scenario: Caller can override or extend registry

- **WHEN** the caller passes `registry` in `RunOptions` (e.g. by using createBuiltinRegistry and adding a handler, or by providing a full custom registry)
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
- **AND** no outputs from that step are written into context (that step id is not updated)
- **AND** the flow result has `success: false`

### Requirement: FlowStep SHALL be a generic shape

`FlowStep` SHALL be defined as a generic object with at least `id: string` and `type: string`, and any additional keys (e.g. `[key: string]: unknown`) preserved for the handler. The parser SHALL produce this shape for every step; it SHALL NOT validate type-specific fields for built-in types (validation responsibility moves to handlers or optional schema).

#### Scenario: Parser accepts any string type

- **WHEN** YAML contains a step with `id: 's1'`, `type: 'custom'`, and extra keys `foo: 1`, `bar: 'x'`
- **THEN** the parser SHALL include a step object with `id: 's1'`, `type: 'custom'`, and the extra keys preserved
- **AND** the parser SHALL NOT return null solely because `type` is not a known built-in

#### Scenario: Parser requires id and type

- **WHEN** a step in YAML is missing `id` or `type`, or `type` is not a string
- **THEN** the parser SHALL return null (invalid flow) or otherwise reject the step

### Requirement: Substitution SHALL be applied by the executor before calling handler

Before invoking a step's handler, the executor SHALL apply template substitution to the step's string-valued fields using the current context (params and previous outputs). The handler SHALL receive the step object with substitution already applied so that handlers do not need to perform substitution themselves.

#### Scenario: Handler receives substituted step

- **WHEN** context has `base: 'https://api.example.com'` and the step has `url: '{{ base }}/users'`
- **THEN** the executor substitutes and passes to the handler a step with `url: 'https://api.example.com/users'`
- **AND** the handler may use the step as-is without calling substitute

### Requirement: CLI SHALL build registry using @runflow/handlers plus config and --registry

The CLI SHALL build its registry by using the built-in handlers from `@runflow/handlers` (e.g. start with `createBuiltinRegistry()` or equivalent), then merge config `handlers` and `--registry` modules with `registerStepHandler`. The engine SHALL NOT provide that default; the CLI SHALL do so. (1) **Config file**: when `--config` is given or a file `runflow.config.mjs`, `runflow.config.js`, or `runflow.config.json` is found in cwd (in that discovery order), the config's `handlers` property SHALL be a record mapping step type names to module paths (relative to the config file directory); the CLI SHALL load each module's default export (an `IStepHandler`) and merge it into the registry with `registerStepHandler`. (2) **--registry &lt;path&gt;**: the CLI SHALL load the given ESM module's default export (a `StepRegistry`) and merge each type→handler into the current registry. The final registry SHALL be the merge of built-ins (from `@runflow/handlers`) + config handlers (if any) + --registry module (if any).

#### Scenario: CLI runs flow with built-ins and custom handler

- **WHEN** the user runs the CLI with a config file that has `handlers: { echo: './echo-handler.mjs' }` and the flow contains steps with built-in types and type `'echo'`
- **THEN** the CLI builds a registry from `@runflow/handlers` built-ins plus the loaded echo handler
- **AND** all steps are executed via that registry

#### Scenario: Custom handler from config is used in flow

- **WHEN** the user runs the CLI with a config file that has `handlers: { echo: './echo-handler.mjs' }` and the flow contains a step with `type: 'echo'`
- **THEN** the CLI builds a registry from built-ins + loaded echo handler
- **AND** the step is executed by the echo handler and produces a StepResult like any built-in step

#### Scenario: Custom handler usage is documented

- **WHEN** the user consults the repository
- **THEN** documentation SHALL describe how to implement and register a custom handler (e.g. via `handlers: { type: path }` in runflow config or `--registry`) and how to run a flow that uses the custom step type
- **AND** the handler contract (IStepHandler: run, optional validate) SHALL be documented
