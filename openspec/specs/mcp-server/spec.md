# mcp-server Specification

## Purpose

定義 Runflow 的 MCP Server：以 Model Context Protocol 暴露至少一項 tool「執行指定 flow 檔案」；與既有 CLI 並存，同為 @runflow/core 的消費者；透過 stdio 或 SSE 與 MCP 客戶端（如 Cursor）通訊。

## Requirements

### Requirement: MCP Server MUST expose a tool to run a flow file

The server SHALL expose at least one MCP tool that accepts a flow file path (and optionally parameters) and runs that flow using @runflow/core with a registry built from @runflow/handlers. The tool name and argument shape SHALL be described in the server's tool list so that MCP clients can discover and invoke it.

#### Scenario: Client invokes run-flow tool with valid path

- **WHEN** the MCP client calls the tool with argument `{ flowPath: "/path/to/flow.yaml" }` (or equivalent) and the path exists and is a valid flow file
- **THEN** the server loads the flow via core's loader, runs it with a built-in registry (e.g. createBuiltinRegistry from @runflow/handlers), and returns a result to the client
- **AND** the tool result includes success/failure and run output (e.g. final context or step results) in a format suitable for the client (e.g. text or structured content)

#### Scenario: Client invokes run-flow tool with optional params

- **WHEN** the tool accepts an optional `params` (or equivalent) argument and the client passes key-value parameters
- **THEN** the server passes those params to `run(flow, { params, registry })` so the flow receives them as initial context
- **AND** the run executes with the same semantics as the CLI when given params

#### Scenario: Run-flow tool with invalid or missing file

- **WHEN** the flow path does not exist or is not a valid flow file
- **THEN** the tool returns an error (MCP tool error or content indicating failure)
- **AND** the error message SHALL be actionable (e.g. "file not found" or "invalid flow YAML")

### Requirement: MCP Server SHALL use @runflow/core and @runflow/handlers only

The server SHALL depend on @runflow/core (loader, run, types) and @runflow/handlers (createBuiltinRegistry). It SHALL NOT duplicate flow execution logic; it SHALL build a registry via createBuiltinRegistry (or equivalent) and pass it to run() as the CLI does.

#### Scenario: No custom handlers in initial implementation

- **WHEN** the server runs a flow
- **THEN** it uses the same built-in registry as the CLI (http, condition, sleep, set, loop, flow)
- **AND** config-based or custom handlers (e.g. from runflow.config) are out of scope for the first version unless specified otherwise in design

### Requirement: MCP Server SHALL support stdio transport

The server SHALL be startable as a subprocess and communicate over stdio using the MCP transport (stdio JSON-RPC). This allows MCP clients like Cursor to launch the server and exchange messages without a network port.

#### Scenario: Client starts server and lists tools

- **WHEN** the client spawns the server process (e.g. `node apps/mcp-server/dist/index.js` or via npx) with stdio connected
- **THEN** the server responds to MCP initialize and lists its tools (at least the run-flow tool)
- **AND** the client can subsequently call the run-flow tool and receive results

### Requirement: Output and errors SHALL be reported to the client

When a flow run completes (success or failure), the server SHALL return a result to the client that reflects the outcome. When the flow or a step fails, the error SHALL be included in the tool result so the user can diagnose (e.g. step id, error message).

#### Scenario: Flow completes successfully

- **WHEN** the flow runs to completion without step failures
- **THEN** the tool result indicates success and MAY include a summary or final context (e.g. as text or JSON in content)
- **AND** the client can display the result to the user

#### Scenario: Flow or step fails

- **WHEN** the flow fails (e.g. loader error, step error)
- **THEN** the tool result indicates failure and includes the error message (and optionally step id)
- **AND** the client receives a non-success result with actionable error content

## Non-requirements (out of scope for this spec)

- MCP Resources (e.g. listing flows as resources) are not required in the first version.
- Custom handler registration from config (runflow.config) is optional; initial implementation may use only createBuiltinRegistry.
- SSE transport is optional; stdio is required first.
