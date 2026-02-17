# config-params-declaration Specification

## Purpose

Config may define global param declarations so all flows share a common contract. The config key is `params` and its value is a ParamDeclaration array (same shape as a flow's params). Defaults live in each declaration's `default`. For each run, the effective declaration is config.params merged with flow.params, with flow overriding config for the same param name. Runners (CLI, MCP) build this effective declaration and pass it to run(); run() validates options.params against it.

## ADDED Requirements

### Requirement: RunflowConfig SHALL allow optional params as ParamDeclaration array

RunflowConfig SHALL define an optional property **params** whose type is **ParamDeclaration[]** (array of param declarations: name, type, required?, default?, enum?, description?, schema?, items?). When present, it SHALL be the global param declaration for the workspace. Default values for global params SHALL be specified in each item's `default` field; there SHALL be no separate "params values" object in config.

#### Scenario: Config with params array is valid

- **WHEN** a config file contains `params: [{ name: "env", type: "string", default: "development" }, { name: "logLevel", type: "string", enum: ["info", "warn"], default: "info" }]`
- **THEN** loadConfig SHALL return a RunflowConfig with params as that array
- **AND** runners MAY use it to build the effective declaration for run()

#### Scenario: Config without params

- **WHEN** a config file omits the `params` key
- **THEN** RunflowConfig.params SHALL be undefined
- **AND** effective declaration for a run SHALL be the flow's params only (unchanged behavior)

### Requirement: Effective declaration SHALL be config params merged with flow params with flow override

When both config.params and flow.params exist, the effective param declaration for a run SHALL be computed as: start with config.params; for each param in flow.params, if a param with the same name already exists in the list, replace it; otherwise append. The result SHALL have no duplicate names; flow.params SHALL override config.params for the same name.

#### Scenario: Flow overrides global param with same name

- **WHEN** config.params contains `[{ name: "env", type: "string", default: "development" }]` and flow.params contains `[{ name: "env", type: "string", default: "production" }]`
- **THEN** the effective declaration for that flow SHALL include exactly one param named "env" with default "production"
- **AND** validation and default application SHALL use the flow's definition for "env"

#### Scenario: Flow adds param not in config

- **WHEN** config.params contains `[{ name: "env", type: "string", default: "development" }]` and flow.params contains `[{ name: "limit", type: "number", required: true }]`
- **THEN** the effective declaration SHALL include both "env" (from config) and "limit" (from flow)
- **AND** validation SHALL require "limit" and allow "env" with default "development"

### Requirement: Runners SHALL pass effective declaration to run() when config has params

When the runner (CLI or MCP) has loaded a config that contains params (ParamDeclaration[]) and has loaded a flow, it SHALL compute the effective declaration (config.params merged with flow.params, flow override) and SHALL pass it to run() via RunOptions (e.g. effectiveParamsDeclaration). It SHALL pass options.params built from declaration defaults and caller-supplied overrides (-f, --param or tool args).

#### Scenario: CLI passes effective declaration and params to run

- **WHEN** CLI runs a flow with config that has params and the flow has params
- **THEN** CLI SHALL merge config.params with flow.params (flow wins on same name) to form effectiveParamsDeclaration
- **AND** CLI SHALL pass effectiveParamsDeclaration and params (from config defaults + -f + --param) to run(flow, options)
- **AND** run() SHALL validate options.params against effectiveParamsDeclaration

### Requirement: Legacy config params as object MAY be normalized to ParamDeclaration array

When loadConfig reads a config file and the value of `params` is a plain object (Record), the loader MAY normalize it to ParamDeclaration[] by mapping each key to an entry with name = key, type = "string", default = value. This SHALL be for backward compatibility only; documentation SHALL describe migration to the array form.

#### Scenario: Legacy params object is normalized

- **WHEN** a config file contains `params: { env: "example", name: "Guest" }` and the loader supports legacy normalization
- **THEN** loadConfig SHALL return RunflowConfig with params equal to `[{ name: "env", type: "string", default: "example" }, { name: "name", type: "string", default: "Guest" }]` (or equivalent order)
- **AND** callers SHALL receive a consistent ParamDeclaration[] shape
