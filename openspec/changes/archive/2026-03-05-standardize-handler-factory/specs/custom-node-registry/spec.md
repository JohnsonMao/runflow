## MODIFIED Requirements

### Requirement: StepHandler interface SHALL be the single execution contract

The system SHALL define a new handler contract via `defineHandler({ type: string, schema?, flowControl?, run: (context: HandlerContext) => Promise<SimpleResult | void> })`. Every step type MUST be executed by invoking the `run` function provided by a `HandlerConfig`. The engine SHALL NOT branch on step type with built-in logic; it SHALL ONLY look up the handler in the registry and invoke its `run` method. The `IStepHandler` class-based interface and its corresponding `HandlerAdapter` are REMOVED.

#### Scenario: Execution dispatches via config in registry
- **WHEN** a flow step has `type: 'http'` and a registry containing an http handler config is used
- **THEN** the executor looks up the config for `'http'` and calls its `run` function
- **AND** if no config is found for the type, it SHALL produce an error result as before

### Requirement: Engine SHALL NOT provide a default registry; registry SHALL be required when flow has steps

The system SHALL define a registry type (e.g. `StepRegistry`) and SHALL export a `buildRegistry(handlers: HandlerConfig[])` helper. This helper SHALL take an array of `HandlerConfig` (produced by handler factories) and SHALL automatically build a registry where each handler is mapped to its internal `type`. This REPLACES the previous key-based object registration. The engine SHALL NOT provide a default registry or `createDefaultRegistry`. When the flow has steps to execute, `run(flow, options)` SHALL require a valid `registry` in `RunOptions`; if `registry` is missing, the engine SHALL fail fast.

#### Scenario: Building registry from array
- **WHEN** `buildRegistry([echoHandlerConfig, httpHandlerConfig])` is called
- **THEN** it SHALL return a registry where `echoHandlerConfig.type` maps to `echoHandlerConfig` and `httpHandlerConfig.type` maps to `httpHandlerConfig`
- **AND** the caller SHALL NOT need to manually specify the string key for each handler

### Requirement: CLI SHALL build registry using @runflow/handlers plus config and --registry

The CLI SHALL build its registry by collecting `HandlerConfig` objects from `@runflow/handlers` and any custom handlers defined in the workspace config. The CLI SHALL support loading multiple handlers from a single module if the module exports an array of factories. The registration process MUST be array-based to ensure consistent handling of built-in and custom handlers.

#### Scenario: CLI loads custom handler from config array
- **WHEN** a config defines `handlers: ['./my-echo.ts', './my-log.ts']` (array format)
- **THEN** the CLI SHALL load both factories and register them in the registry using their internal `type` property
- **AND** both step types SHALL be available for flow execution
