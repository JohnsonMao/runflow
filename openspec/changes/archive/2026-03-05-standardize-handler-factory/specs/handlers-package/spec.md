## MODIFIED Requirements

### Requirement: Package SHALL be named and depend only on core

The built-in handlers package `@runflow/handlers` SHALL NOT depend on `@runflow/core` in its production `dependencies`. It SHALL include core in `devDependencies` for type support in tests, but it MUST NOT import any code from `@runflow/core` in its handler implementations. All necessary types and tools MUST be provided via the factory context injected by the engine at runtime.

#### Scenario: No runtime dependency on core
- **WHEN** the `package.json` for `@runflow/handlers` is inspected
- **THEN** `@runflow/core` SHALL NOT be listed in the `dependencies` section
- **AND** the handler source code SHALL NOT contain `import` statements from `@runflow/core`

### Requirement: Handlers SHALL implement IStepHandler from core

Each built-in step type SHALL be implemented as a `HandlerFactory` function. These factories SHALL use only the tools injected via the factory context (`defineHandler`, `z`, `utils`, etc.). The `IStepHandler` class-based interface is REMOVED, and built-in handlers MUST NOT inherit from any base class or implement any interface from `@runflow/core` at runtime.

#### Scenario: Http handler implementation as factory
- **WHEN** the `http` handler is inspected
- **THEN** it SHALL be a factory function exporting a configuration with `type: 'http'`, `schema`, and `run`
- **AND** it SHALL NOT depend on any class or interface from `@runflow/core`

### Requirement: Package SHALL export all built-in handler classes and a registration helper

The package SHALL export a `builtinHandlers` constant that is an array of all built-in `HandlerFactory` functions. It SHALL NO LONGER export class constructors or the `createBuiltinRegistry` helper (logic moved to core's `buildRegistry`). This array SHALL be used by callers to build a registry.

#### Scenario: Getting all built-ins as an array
- **WHEN** a caller imports `builtinHandlers` from `@runflow/handlers`
- **THEN** it SHALL receive an array of factory functions for `http`, `condition`, `sleep`, `set`, `loop`, `flow`
- **AND** the caller SHALL be able to use `buildRegistry(builtinHandlers.map(f => f(context)))` to initialize a registry
