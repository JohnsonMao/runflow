# handler-factory-pattern Specification

## Purpose

Define the new Zero-Import Handler Factory pattern. This replaces the `IStepHandler` class-based interface with a functional factory that receives injected dependencies (`z`, `defineHandler`, `utils`, etc.). This pattern allows handlers to be defined in plain `.ts` files without explicit imports of core types, improving DX and simplifying maintenance.

## ADDED Requirements

### Requirement: Handlers SHALL be defined via a Factory function

The system SHALL support defining step handlers as a default export of a factory function. This function SHALL receive a context object containing tools (`defineHandler`, `z`, `utils`, etc.) and MUST return a handler definition using `defineHandler`. The canonical pattern SHALL be: `export default ({ defineHandler }) => defineHandler({ ... })`.

#### Scenario: Basic handler factory definition
- **WHEN** a handler file contains `export default ({ defineHandler }) => defineHandler({ ... })`
- **THEN** the engine SHALL invoke this factory with the required tools
- **AND** the returned handler definition SHALL be registered in the step registry

### Requirement: defineHandler SHALL support Zod schema for step validation

The `defineHandler` tool SHALL accept an optional `schema` property using Zod. When present, the engine SHALL use this schema to validate the step configuration before execution. The `run` function's `step` parameter SHALL automatically infer types from this schema if provided.

#### Scenario: Handler with schema validation
- **WHEN** a handler defines `schema: z.object({ url: z.string().url() })`
- **THEN** the engine SHALL validate the step's `url` property before running
- **AND** if validation fails, the engine SHALL return a `StepResult` with `success: false` and the Zod error message

### Requirement: Handlers SHALL report results via context or return

The handler's `run` function SHALL receive a `context` object (of type `HandlerContext`) with a `report(result: SimpleResult)` method. Handlers MAY call `context.report()` multiple times to emit intermediate results or logs. Handlers MAY also return a `SimpleResult` object (or `void`) from the `run` function. The engine SHALL aggregate these reports. If `run` returns a result, it SHALL be treated as the final report.

**Note**: The `HandlerContext` does NOT include `utils`. Handlers SHALL access `utils` from the `FactoryContext` closure (captured when the factory function is invoked).

#### Scenario: Handler reports results via context
- **WHEN** a handler calls `context.report({ log: 'processing...' })` then `context.report({ success: true, outputs: { val: 1 } })`
- **THEN** the engine SHALL capture both reports
- **AND** the final `StepResult` SHALL reflect the accumulated state (success: true, outputs: { val: 1 })

### Requirement: Engine SHALL inject AbortSignal for lifecycle management

The context passed to the handler's `run` function SHALL include a `signal: AbortSignal`. The engine SHALL trigger this signal on step timeout or when the run is aborted. Handlers SHALL use this signal for asynchronous operations (e.g., `fetch`, child processes).

#### Scenario: Handler uses injected AbortSignal
- **WHEN** a handler performs a `fetch(url, { signal })`
- **THEN** the request SHALL be aborted if the engine triggers the signal
- **AND** the handler SHALL NOT need to manually manage `AbortController` or `kill()` method

### Requirement: Factory context SHALL provide utility tools

The factory function SHALL receive a `utils` object containing common helpers (e.g., `isPlainObject`). This ensures handlers can perform common tasks without importing external utility libraries.

#### Scenario: Handler uses injected utils
- **WHEN** a handler calls `utils.isPlainObject(step.data)`
- **THEN** it SHALL correctly identify if the value is a plain object
- **AND** no `import` statement for utility functions SHALL be required in the handler file
