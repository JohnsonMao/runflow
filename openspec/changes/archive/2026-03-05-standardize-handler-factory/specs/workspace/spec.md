## MODIFIED Requirements

### Requirement: Workspace SHALL provide config discovery and loading

The `RunflowConfig`'s `handlers` property SHALL support being an array of module paths (strings). When an array is provided, the workspace SHALL load each module, invoke the factory (or factories) it exports, and SHALL register them in a registry where their internal `type` property is used as the key. The workspace SHALL NO LONGER require a mapping object where the type key is specified in the config.

#### Scenario: Array-based handler configuration in config
- **WHEN** a config defines `handlers: ['./my-echo.ts', './my-log.ts']` (array format)
- **THEN** the workspace loader SHALL import each file and register them according to their internal `type`
- **AND** the handler type SHALL NOT be specified in the config file (it comes from the factory)

### Requirement: Workspace SHALL provide createResolveFlow for core

The `buildRegistryFromConfig` helper in the workspace package SHALL be updated to import the `builtinHandlers` array from `@runflow/handlers`. It SHALL initialize these factories and combine them with any custom handlers from the config to build the final `StepRegistry` using the array-based `buildRegistry` mechanism.

#### Scenario: Building full registry with builtin and custom handlers
- **WHEN** `buildRegistryFromConfig(config)` is called
- **THEN** it SHALL combine the `builtinHandlers` array with the handlers loaded from the config
- **AND** it SHALL return a `StepRegistry` containing both built-in and custom handlers correctly mapped by their internal `type`
