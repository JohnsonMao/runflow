# custom-node-registry (Delta)

## Purpose

本 change 對 main spec 的變更：移除「core 提供 createDefaultRegistry」；改為由呼叫端主動建 registry 並註冊所需 handler（內建來自 `@runflow/handlers`）。其餘契約不變。

---

## REMOVED Requirements

### Requirement: Registry type and default registry SHALL be provided (removed)

The main spec previously required the system to provide `createDefaultRegistry()` and to use it when `run(flow, options)` was called without a `registry` in options. This requirement is removed.

#### Scenario: Default registry no longer exists

- **WHEN** code imports from `@runflow/core`
- **THEN** there SHALL be no export `createDefaultRegistry`
- **AND** the engine SHALL NOT create or use a default registry when registry is omitted

---

## ADDED Requirements

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

### Requirement: CLI SHALL build registry using @runflow/handlers plus config and --registry

The CLI SHALL build its registry by using the built-in handlers from `@runflow/handlers` (e.g. start with `createBuiltinRegistry()` or equivalent), then merge config `handlers` and `--registry` modules with `registerStepHandler`. The engine SHALL NOT provide that default; the CLI SHALL do so.

#### Scenario: CLI runs flow with built-ins and custom handler

- **WHEN** the user runs the CLI with a config file that has `handlers: { echo: './echo-handler.mjs' }` and the flow contains steps with built-in types and type `'echo'`
- **THEN** the CLI builds a registry from `@runflow/handlers` built-ins plus the loaded echo handler
- **AND** all steps are executed via that registry
