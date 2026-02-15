# mcp-server (delta): optimize-discover-display

Delta for tool naming (executor_flow, discover_flow_list, discover_flow_detail) and discover list/detail split with pagination hint.

## MODIFIED Requirements

### Requirement: MCP Server MUST expose a tool to run a flow

The server SHALL expose an MCP tool named **executor_flow** that accepts a **flowId** (and optionally parameters) and runs that flow using @runflow/core with a registry built from @runflow/handlers (and optionally from runflow.config). The tool name and argument shape SHALL be described in the server's tool list so that MCP clients can discover and invoke it. The argument SHALL be named **flowId** (not flowPath). flowId SHALL denote either a file path (absolute or relative to config.flowsDir or cwd) or an OpenAPI-derived flow in the form `prefix-operation` (e.g. `my-api-get-users`) when config.openapi is present; resolution semantics SHALL match the CLI.

#### Scenario: Client invokes executor_flow tool with file flowId

- **WHEN** the MCP client calls the tool with argument `{ flowId: "/path/to/flow.yaml" }` or `{ flowId: "subdir/flow.yaml" }` (relative to config.flowsDir or cwd) and the resolved path exists and is a valid flow file
- **THEN** the server loads the flow via core's loader, runs it with the appropriate registry, and returns a result to the client
- **AND** the tool result includes success/failure and run output (e.g. final context or step results) in a format suitable for the client (e.g. text or structured content)

#### Scenario: Client invokes executor_flow tool with OpenAPI flowId (prefix-operation)

- **WHEN** config is loaded and has an `openapi` block keyed by prefix, and the client calls the tool with a flowId of the form `prefix-operation` (e.g. `my-api-get-users`) matching one configured prefix
- **THEN** the server SHALL resolve the flow from the OpenAPI spec for that prefix (using specPath and options such as hooks), select the operation by the suffix after the first `-`, and run that flow with the same semantics as for file flowIds
- **AND** the tool result SHALL indicate success or failure and include run output or error content as for file flows

#### Scenario: Client invokes executor_flow tool with optional params

- **WHEN** the tool accepts an optional `params` (or equivalent) argument and the client passes key-value parameters
- **THEN** the server passes those params to `run(flow, { params, registry })` so the flow receives them as initial context
- **AND** the run executes with the same semantics as the CLI when given params

#### Scenario: executor_flow tool with invalid or missing flowId

- **WHEN** the flowId does not resolve to an existing file and does not match any config openapi prefix-operation, or the resolved file is not a valid flow file, or the openapi operation is not found
- **THEN** the tool returns an error (MCP tool error or content indicating failure)
- **AND** the error message SHALL be actionable (e.g. "file not found", "invalid flow YAML", or "operation not found")

### Requirement: discover_flow_list SHALL use config.flowsDir as default when present

When config is loaded and has `flowsDir`, the **discover_flow_list** tool SHALL use the resolved flowsDir as the default search root for file flows when building the catalog. This SHALL be consistent with executor_flow's file flowId resolution. The catalog SHALL also include OpenAPI-derived flows (see requirement on cached catalog).

#### Scenario: Default directory when config has flowsDir

- **WHEN** the client calls discover_flow_list (and catalog is built) and config is loaded with `flowsDir`
- **THEN** the server SHALL use the resolved flowsDir as the directory to search for flow files when building the catalog
- **AND** behavior SHALL be consistent with the CLI use of flowsDir for resolving file flowIds

### Requirement: discover_flow_list SHALL list flows from a cached catalog (flowsDir + OpenAPI)

When the server exposes the **discover_flow_list** tool, the server SHALL build and maintain an in-memory catalog of flows after config is loaded. The catalog SHALL include:

1. **File flows**: All valid flow files under config.flowsDir (or cwd when flowsDir is not set), discovered by scanning for `.yaml` files with the same rules as today (e.g. recursive, no symlinks, within allowedRoot). Each entry SHALL have a source of `file`.
2. **OpenAPI flows**: For each prefix in config.openapi, the server SHALL load the corresponding spec (specPath) and SHALL convert operations to flows using the same convention as executor_flow (e.g. openApiToFlows). Each such flow SHALL be represented in the catalog with flowId equal to `prefix-operation` and source `openapi`.

The discover_flow_list tool SHALL query this catalog (with optional keyword, limit, and offset) and SHALL NOT re-scan the filesystem or re-parse OpenAPI specs on each call. The catalog MAY be built lazily (e.g. on first list/detail or first config load) and MAY be invalidated when config is reloaded (if the server supports config reload).

#### Scenario: discover_flow_list returns file flows and OpenAPI flows

- **WHEN** config is loaded with flowsDir and openapi (at least one prefix), and the client calls discover_flow_list with no keyword (or a keyword that matches some flows)
- **THEN** the tool result SHALL include both file-based flows (flowId = path relative to flowsDir or absolute, type file) and OpenAPI-derived flows (flowId = prefix-operation, type openapi)
- **AND** the number of rows returned SHALL respect the limit parameter and offset (default limit and max are implementation-defined; pagination SHALL be supported via offset)

#### Scenario: Keyword filter applies to both file and OpenAPI flows

- **WHEN** the client calls discover_flow_list with a keyword
- **THEN** the server SHALL filter the catalog by that keyword (case-insensitive) against: flowId (path or prefix-operation string), flow name, and flow description
- **AND** only matching flows SHALL be returned, still subject to limit and offset

### Requirement: MCP Server SHALL support stdio transport

The server SHALL be startable as a subprocess and communicate over stdio using the MCP transport (stdio JSON-RPC). This allows MCP clients like Cursor to launch the server and exchange messages without a network port.

#### Scenario: Client starts server and lists tools

- **WHEN** the client spawns the server process (e.g. `node apps/mcp-server/dist/index.js` or via npx) with stdio connected
- **THEN** the server responds to MCP initialize and lists its tools: **executor_flow**, **discover_flow_list**, and **discover_flow_detail**
- **AND** the client can subsequently call those tools and receive results

## REMOVED Requirements

### Requirement: discover SHALL return flowId, name, description, params in Markdown

**Reason:** Replaced by discover_flow_list (compact table: flowId, name, type) and discover_flow_detail (single-flow full description and params).

**Migration:** Use discover_flow_list for listing flows; use discover_flow_detail(flowId) to get one flow's full description and params.

## ADDED Requirements

### Requirement: discover_flow_list SHALL return a compact Markdown table with pagination hint

The discover_flow_list tool result content SHALL be **Markdown text**. The Markdown SHALL include:

- A first line indicating total count and current range (e.g. "Total: N flows. Showing start–end.").
- A **Markdown table** with columns: **flowId** | **name** | **type**. Each row SHALL be one flow. type SHALL be `file` or `openapi`.
- When there are more flows after the current page (i.e. offset + limit < total), the result SHALL append a **pagination hint** line (e.g. "下一批：使用 discover_flow_list(offset=N) 取得第 M–K 筆") so the client knows how to request the next page.

#### Scenario: discover_flow_list result is Markdown table with type and pagination hint

- **WHEN** the client calls discover_flow_list and at least one flow is found and total > limit (so there is a next page)
- **THEN** the tool result content (text) SHALL be valid Markdown with a table of flowId, name, type and a pagination hint line indicating the next offset and range
- **AND** the client MAY render it as rich text (e.g. in Cursor)

#### Scenario: discover_flow_list with no flows in range

- **WHEN** the catalog is empty or no flow matches the keyword, or offset is beyond the filtered count
- **THEN** the tool result SHALL indicate that no flows were found or no flows in this range (e.g. a short Markdown message), without a table when there are zero rows

### Requirement: MCP Server SHALL expose discover_flow_detail tool

The server SHALL expose an MCP tool named **discover_flow_detail** that accepts a required **flowId** and returns that flow's **name**, **description**, and **params** (path/query/body; body params MAY be expanded) as Markdown text. The flow SHALL be looked up from the same cached catalog used by discover_flow_list. If the flowId is not in the catalog, the tool SHALL return an error (MCP tool error or Markdown message indicating not found).

#### Scenario: discover_flow_detail returns one flow's full detail

- **WHEN** the client calls discover_flow_detail with a flowId that exists in the catalog
- **THEN** the tool result content SHALL be Markdown that includes that flow's name, description (if present), and params summary (path/query/body; body fields MAY be listed)
- **AND** the client MAY use this to display or pass params to executor_flow

#### Scenario: discover_flow_detail with unknown flowId

- **WHEN** the client calls discover_flow_detail with a flowId that is not in the catalog
- **THEN** the tool returns an error or a short Markdown message indicating the flow was not found
- **AND** the message SHALL be actionable (e.g. "Flow not found: <flowId>")
