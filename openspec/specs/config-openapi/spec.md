# Spec: config-openapi

## ADDED Requirements

### Requirement: Config MAY define an openapi block

The runflow config (e.g. `runflow.config.mjs`) MAY export an `openapi` object. When present, it SHALL be used by the CLI as the default source for OpenAPI-related options when running flows with `--from-openapi`. Paths inside `openapi` SHALL be resolved relative to the directory of the config file.

#### Scenario: Config without openapi block

- **WHEN** config is loaded and has no `openapi` property
- **THEN** CLI SHALL use only CLI arguments (e.g. `--from-openapi`) and built-in defaults for `openApiToFlows` options

#### Scenario: Config with openapi block

- **WHEN** config is loaded and has an `openapi` object with at least one property
- **THEN** CLI SHALL pass the resolved options to `openApiToFlows` when invoking with `--from-openapi`, and CLI-provided values SHALL override config values for the same option

### Requirement: openapi.specPath and openapi.outDir

The `openapi` block MAY include `specPath` (string) and `outDir` (string). `specPath` SHALL be the default path to the OpenAPI spec file (relative to config directory or absolute). `outDir` SHALL be the default output directory when writing generated flows to disk (equivalent to `output: { outputDir }` in `openApiToFlows` options).

#### Scenario: specPath used as default when CLI omits path

- **WHEN** config has `openapi.specPath` and the user invokes run with `--from-openapi` without a path (e.g. future flag to use default) or the implementation uses config as default
- **THEN** the system SHALL resolve the spec file path from config directory when relative

#### Scenario: outDir used when writing flows

- **WHEN** config has `openapi.outDir` and the CLI or convention writes generated flows to disk
- **THEN** the system SHALL resolve the output directory from config directory when relative and SHALL write flow files under that directory

### Requirement: openapi options passed to openApiToFlows

The `openapi` block MAY include `baseUrl`, `operationFilter`, and `hooks` with the same semantics as `OpenApiToFlowsOptions`. The CLI SHALL merge these with any options derived from CLI flags and SHALL pass the merged options to `openApiToFlows`.

#### Scenario: baseUrl from config

- **WHEN** config has `openapi.baseUrl` and user runs with `--from-openapi <spec> --operation <key>`
- **THEN** the system SHALL call `openApiToFlows(spec, { ...config.openapi, output: 'memory' })` (or equivalent) so that `baseUrl` is applied to generated flows

#### Scenario: CLI overrides config

- **WHEN** both config and CLI provide the same option (e.g. a future `--base-url` flag)
- **THEN** the value from CLI SHALL take precedence over the config value
