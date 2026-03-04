# custom-node-registry Specification (Delta)

## MODIFIED Requirements

### Requirement: StepHandler interface SHALL be the single execution contract

The system SHALL define a new handler contract via `defineHandler({ schema?, flowControl?, run: (context: HandlerContext) => Promise<SimpleResult | void> })`. Every step type (including built-in and custom) MUST be executed by invoking the `run` function provided by the handler's factory. The engine SHALL NOT branch on step type with built-in logic; it SHALL only look up the handler configuration and invoke its `run` method.

#### Scenario: Execution dispatches via registry
- **WHEN** a flow step has `type: 'http'` and the caller-provided registry is used
- **THEN** the executor looks up the handler configuration for `'http'` in the registry and calls its `run` function with the step context
- **AND** the handler MAY report results via `context.report()` or `return`

### Requirement: StepContext SHALL provide params, previous outputs, and report

`StepContext` MUST include at least: `params` (merged view of initial params and previous outputs) and `report(result: SimpleResult)`. The engine SHALL also pass a `signal: AbortSignal` for asynchronous lifecycle management. The engine SHALL pass the same context shape to every handler's `run` function so that built-in and custom handlers behave consistently.

#### Scenario: Handler receives previous outputs in context under step id
- **WHEN** step A with `id: 'a'` produced `outputs: { x: 1 }` and step B is about to run
- **THEN** the context passed to step B's handler SHALL include `params.a.x === 1`
- **AND** template substitution SHALL have been applied to the step by the executor before invoking the handler

### Requirement: StepResult contract SHALL be unchanged, but delivered via context

The core `StepResult` data structure (including `stepId`, `stdout`, `stderr`) SHALL remain unchanged. However, handlers SHALL deliver results via `context.report(partialResult)` or by returning a `SimpleResult` object. The engine SHALL automatically convert these reports to the internal `StepResult` format. If multiple reports are received, the engine SHALL merge them (e.g., appending logs, merging outputs).

#### Scenario: Handler reports via context
- **WHEN** a handler calls `context.report({ log: 'step 1 done' })`
- **THEN** the engine updates the current step result with the log
- **AND** the flow continues execution

### Requirement: CLI SHALL build registry using @runflow/handlers plus config and --registry

The CLI SHALL build its registry by using the built-in handlers from `@runflow/handlers`, then merge config `handlers` and `--registry` modules. The engine SHALL NOT provide that default. (1) **Config file**: the config's `handlers` property SHALL be a record mapping step type names to module paths (relative to the config file directory). (2) **--registry <path>**: the CLI SHALL load the given module's default export. The CLI SHALL support direct loading of `.ts` handler files using a runtime loader (e.g., `tsx` or `jiti`) so that users can define handlers without a separate build step.

#### Scenario: CLI runs flow with .ts custom handler
- **WHEN** the user runs the CLI with a config file that has `handlers: { echo: './echo-handler.ts' }`
- **THEN** the CLI SHALL use a dynamic loader to import the factory from the TS file
- **AND** the CLI SHALL initialize the factory with the tool context and register the resulting handler
- **AND** the flow step with `type: 'echo'` SHALL be executed correctly
