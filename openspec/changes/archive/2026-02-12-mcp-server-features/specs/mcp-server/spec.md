# mcp-server Specification (delta)

## MODIFIED Requirements

### Requirement: MCP Server MUST expose a tool to run a flow

The server SHALL expose at least one MCP tool named **execute** that accepts a **flowId** (and optionally parameters) and runs that flow using @runflow/core with a registry built from @runflow/handlers (and optionally from runflow.config). The tool name and argument shape SHALL be described in the server's tool list so that MCP clients can discover and invoke it. The argument SHALL be named **flowId** (not flowPath). flowId SHALL denote either a file path (absolute or relative to config.flowsDir or cwd) or an OpenAPI-derived flow in the form `prefix-operation` (e.g. `my-api-get-users`) when config.openapi is present; resolution semantics SHALL match the CLI.

#### Scenario: Client invokes execute tool with file flowId

- **WHEN** the MCP client calls the tool with argument `{ flowId: "/path/to/flow.yaml" }` or `{ flowId: "subdir/flow.yaml" }` (relative to config.flowsDir or cwd) and the resolved path exists and is a valid flow file
- **THEN** the server loads the flow via core's loader, runs it with the appropriate registry, and returns a result to the client
- **AND** the tool result includes success/failure and run output (e.g. final context or step results) in a format suitable for the client (e.g. text or structured content)

#### Scenario: Client invokes execute tool with OpenAPI flowId (prefix-operation)

- **WHEN** config is loaded and has an `openapi` block keyed by prefix, and the client calls the tool with a flowId of the form `prefix-operation` (e.g. `my-api-get-users`) matching one configured prefix
- **THEN** the server SHALL resolve the flow from the OpenAPI spec for that prefix (using specPath and options such as hooks), select the operation by the suffix after the first `-`, and run that flow with the same semantics as for file flowIds
- **AND** the tool result SHALL indicate success or failure and include run output or error content as for file flows

#### Scenario: Client invokes execute tool with optional params

- **WHEN** the tool accepts an optional `params` (or equivalent) argument and the client passes key-value parameters
- **THEN** the server passes those params to `run(flow, { params, registry })` so the flow receives them as initial context
- **AND** the run executes with the same semantics as the CLI when given params

#### Scenario: Execute tool with invalid or missing flowId

- **WHEN** the flowId does not resolve to an existing file and does not match any config openapi prefix-operation, or the resolved file is not a valid flow file, or the openapi operation is not found
- **THEN** the tool returns an error (MCP tool error or content indicating failure)
- **AND** the error message SHALL be actionable (e.g. "file not found", "invalid flow YAML", or "operation not found")

### Requirement: MCP Server SHALL use @runflow/core and @runflow/handlers

The server SHALL depend on @runflow/core (loader, run, types) and @runflow/handlers (createBuiltinRegistry). It SHALL NOT duplicate flow execution logic; it SHALL build a registry via createBuiltinRegistry (or equivalent), and MAY merge handlers from runflow.config when config is present, then pass the registry to run() as the CLI does.

#### Scenario: No config or no custom handlers

- **WHEN** the server runs a flow and no runflow.config is loaded or config has no `handlers` property
- **THEN** it uses the same built-in registry as the CLI (http, condition, sleep, set, loop, flow)

#### Scenario: Config with handlers

- **WHEN** runflow.config is loaded and has a `handlers` property
- **THEN** the server MAY merge those handlers into the registry (same semantics as CLI) so that custom step types are available when running flows

## ADDED Requirements

### Requirement: MCP Server MAY read runflow.config

The server MAY load runflow.config (e.g. runflow.config.mjs, runflow.config.js, or runflow.config.json) from the process working directory or from a path supplied at server startup (e.g. via argv or env). When present, the config SHALL be used for flowId resolution and optional registry extension.

#### Scenario: Config with flowsDir

- **WHEN** config is loaded and has `flowsDir` (string)
- **THEN** file-type flowIds that are not absolute paths SHALL be resolved relative to flowsDir (itself resolved relative to the config file directory)
- **AND** the same semantics SHALL apply as for the CLI

#### Scenario: Config with openapi (prefix-keyed)

- **WHEN** config is loaded and has `openapi` as an object keyed by prefix, each value containing at least `specPath` and optionally `hooks`, `baseUrl`, `operationFilter`
- **THEN** flowIds of the form `prefix-operation` SHALL be resolved by loading the OpenAPI spec for that prefix and selecting the flow for the given operation key
- **AND** paths in config (e.g. specPath) SHALL be resolved relative to the config file directory when not absolute

### Requirement: discover SHALL use config.flowsDir as default when present

When the server exposes a **discover** tool (or equivalent) that accepts an optional directory argument, and config is loaded with `flowsDir`, the server SHALL use the resolved flowsDir as the default search directory when the client does not provide a directory (or provides a value that denotes "default").

#### Scenario: Default directory when config has flowsDir

- **WHEN** the client calls the discover tool without providing a directory (or with an empty/default value) and config is loaded with `flowsDir`
- **THEN** the server SHALL use the resolved flowsDir as the directory to search for flow files
- **AND** behavior SHALL be consistent with the CLI use of flowsDir for resolving file flowIds
