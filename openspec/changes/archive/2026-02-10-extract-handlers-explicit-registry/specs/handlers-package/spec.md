# handlers-package (Delta)

## Purpose

定義內建 step 實作所屬的獨立 package：`@runflow/handlers` 提供所有內建 step 的 handler 實作，僅依賴 `@runflow/core`；core 不依賴此 package。呼叫端若需內建 step，須依賴本 package 並主動註冊至 registry。

---

## ADDED Requirements

### Requirement: Package SHALL be named and depend only on core

The built-in handlers SHALL live in a package named `@runflow/handlers`. This package SHALL have a single dependency: `@runflow/core`. It SHALL NOT depend on any other workspace package. The core package SHALL NOT depend on `@runflow/handlers`.

#### Scenario: No circular dependency

- **WHEN** dependency graph is inspected
- **THEN** `@runflow/handlers` → `@runflow/core` only
- **AND** `@runflow/core` has no dependency on `@runflow/handlers`

### Requirement: Handlers SHALL implement IStepHandler from core

Each built-in step type SHALL be implemented as a class (or object) that implements the `IStepHandler` interface exported by `@runflow/core` (run, optional validate, optional kill). Handlers SHALL use only types and utilities exported by core (e.g. `FlowStep`, `StepContext`, `StepResult`, `stepResult`, `registerStepHandler`; and constants/utils that core exports for handler use).

#### Scenario: Http handler runs via registry

- **WHEN** a caller creates an empty registry, registers `HttpHandler` from `@runflow/handlers` for type `'http'`, and runs a flow with an http step
- **THEN** the executor dispatches to that handler and the step runs as today
- **AND** behavior is unchanged from current core-built-in http handler

### Requirement: Package SHALL export all built-in handler classes and a registration helper

The package SHALL export individual handler classes (or instances): `HttpHandler`, `ConditionHandler`, `SleepHandler`, `SetHandler`, `LoopHandler`, `FlowHandler`. (Command and Js handlers are no longer built-in.) The package SHALL also export a helper that registers all built-in handlers into a given registry (e.g. `createBuiltinRegistry(): StepRegistry`). The engine (core) SHALL NOT call this helper; only callers (CLI, tests, etc.) SHALL use it.

#### Scenario: Caller gets full set of built-ins with one call

- **WHEN** a caller does `const registry = createBuiltinRegistry()` from `@runflow/handlers`, then passes `registry` to `run(flow, { registry })`
- **THEN** flows using any built-in step type (http, condition, sleep, set, loop, flow) run correctly
- **AND** the registry is built by the caller using the handlers package, not provided by core

#### Scenario: Caller registers only some built-in types

- **WHEN** a caller creates an empty registry and registers only `HttpHandler` and `SetHandler` from `@runflow/handlers`
- **THEN** only steps with `type: 'http'` or `type: 'set'` are executed by those handlers
- **AND** steps with other unregistered types produce an error result per engine behavior

### Requirement: Core SHALL export what handlers need

`@runflow/core` SHALL export whatever the handlers package needs: at least types (`IStepHandler`, `FlowStep`, `StepContext`, `StepResult`, `StepRegistry`, etc.), `stepResult`, and any constants or utilities used by handlers (e.g. `isPlainObject`). Only the minimum surface required by handlers SHALL be part of the public API. (DEFAULT_ALLOWED_COMMANDS and allowedCommands are no longer used; command handler was removed.)

#### Scenario: Handlers import from core only

- **WHEN** `@runflow/handlers` is built
- **THEN** its source files import only from `@runflow/core` (and Node built-ins)
- **AND** core's public exports suffice for handlers to implement current behavior

### Requirement: Tests for handlers SHALL live in the handlers package

Unit tests for each built-in handler (http, condition, sleep, set, loop, flow) SHALL be moved with the handler implementations into `@runflow/handlers` and SHALL pass there. Core's test suite SHALL NOT contain handler implementation details; those SHALL live in the handlers package.

#### Scenario: Handlers package tests pass in isolation

- **WHEN** `pnpm --filter @runflow/handlers test` is run
- **THEN** all handler unit tests pass
- **AND** no test file in core contains handler implementation details (those live in handlers)
