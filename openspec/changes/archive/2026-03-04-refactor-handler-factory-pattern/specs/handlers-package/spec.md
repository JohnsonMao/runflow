# handlers-package Specification (Delta)

## MODIFIED Requirements

### Requirement: Handlers SHALL implement IStepHandler from core

Each built-in step type SHALL be implemented as a factory function that returns a configuration object conforming to the new Handler Factory pattern (run, optional schema, optional flowControl). Handlers SHALL NO LONGER be implemented as classes. They SHALL use only tools and types injected via the factory context (`z`, `defineHandler`, `utils`, `params`, `signal`).

#### Scenario: Http handler runs via registry
- **WHEN** a caller creates an empty registry, registers `HttpHandler` factory from `@runflow/handlers` for type `'http'`, and runs a flow with an http step
- **THEN** the executor dispatches to that factory's `run` function and the step runs as today
- **AND** behavior is unchanged from the current class-based http handler

### Requirement: Package SHALL export all built-in handler factories and a registration helper

The package SHALL export individual handler factory functions: `http`, `condition`, `sleep`, `set`, `loop`, `flow`. Each of these SHALL be the default export of its module, conforming to the `export default ({ defineHandler }) => ...` pattern. The package SHALL also export a helper `createBuiltinHandlers(context)` that returns a record of all built-in handler instances initialized with the given context.

#### Scenario: Caller gets full set of built-ins with one call
- **WHEN** a caller does `const handlers = createBuiltinHandlers(factoryContext)` from `@runflow/handlers`
- **THEN** it receives a map of initialized handlers ready for the registry
- **AND** each handler was created using the standard factory pattern

### Requirement: Core SHALL export what handlers need

`@runflow/core` SHALL provide a set of tools to be injected into handler factories: `z` (Zod), `defineHandler` (factory helper), and a `utils` object (chainable string/data helpers). Core SHALL NOT require handlers to import these tools explicitly. Core SHALL also export the necessary types (`FlowStep`, `StepContext`, `StepResult`, `StepRegistry`, etc.) for IDE support, but these SHALL NOT be required for runtime execution of handlers.

#### Scenario: Handlers import from core only
- **WHEN** `@runflow/handlers` is built
- **THEN** its source files contain no `import` from `@runflow/core` in the factory implementation
- **AND** all required tools are provided via the factory context at runtime
