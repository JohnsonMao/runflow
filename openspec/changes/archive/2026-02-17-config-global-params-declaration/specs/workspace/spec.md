# workspace Specification (delta)

## MODIFIED Requirements

### Requirement: Workspace SHALL provide config discovery and loading

The workspace package SHALL export **findConfigFile(cwd)** and **loadConfig(path)**. findConfigFile SHALL return the first existing path among runflow.config.mjs, runflow.config.js, runflow.config.json under the given cwd, or null. loadConfig SHALL load and return the config object (RunflowConfig). RunflowConfig SHALL include an optional **params** property of type **ParamDeclaration[]** (array of param declarations), not Record<string, unknown>. When the config file contains `params` as a plain object (legacy), loadConfig MAY normalize it to ParamDeclaration[] for backward compatibility (see config-params-declaration spec). Config path resolution (e.g. from `--config` or cwd) is the responsibility of the caller (CLI or MCP); workspace does not read environment variables for config path.

#### Scenario: findConfigFile returns first existing config file in cwd

- **WHEN** the caller invokes findConfigFile(cwd) and runflow.config.mjs exists in cwd
- **THEN** the return value SHALL be the path to that file
- **AND** when only runflow.config.js or runflow.config.json exists, that path SHALL be returned instead (order: .mjs, .js, .json)

#### Scenario: loadConfig loads and returns RunflowConfig

- **WHEN** the caller invokes loadConfig(absolutePath) with a valid config file path
- **THEN** the return value SHALL be the config object (RunflowConfig) with optional flowsDir, openapi, handlers, params (params when present SHALL be ParamDeclaration[])
- **AND** paths inside the config are not resolved by workspace; the caller uses configDir (dirname of config path) for resolution
