# mcp-server Specification (delta) — discover cache, OpenAPI, Markdown

本 delta 僅修改 **discover** tool 行為；execute 與其他需求不變。

## MODIFIED Requirements

### Requirement: discover SHALL use config.flowsDir as default when present

When config is loaded and has `flowsDir`, the discover tool SHALL use the resolved flowsDir as the default search root for file flows. This SHALL be consistent with execute's file flowId resolution. The following requirement extends discover to also include OpenAPI-derived flows in a cached catalog.

#### Scenario: Default directory when config has flowsDir

- **WHEN** the client calls discover without providing a directory (or with an empty/default value) and config is loaded with `flowsDir`
- **THEN** the server SHALL use the resolved flowsDir as the directory to search for flow files when building the catalog
- **AND** behavior SHALL be consistent with the CLI use of flowsDir for resolving file flowIds

### Requirement: discover SHALL list flows from a cached catalog (flowsDir + OpenAPI)

When the server exposes the **discover** tool, the server SHALL build and maintain an in-memory catalog of flows after config is loaded. The catalog SHALL include:

1. **File flows**: All valid flow files under config.flowsDir (or cwd when flowsDir is not set), discovered by scanning for `.yaml` files with the same rules as today (e.g. recursive, no symlinks, within allowedRoot).
2. **OpenAPI flows**: For each prefix in config.openapi, the server SHALL load the corresponding spec (specPath) and SHALL convert operations to flows using the same convention as execute (e.g. openApiToFlows). Each such flow SHALL be represented in the catalog with flowId equal to `prefix-operation` (e.g. `admin-salepage-GET /api/orders` or the operation key used by the convention).

The discover tool SHALL query this catalog (with optional keyword and limit) and SHALL NOT re-scan the filesystem or re-parse OpenAPI specs on each discover call. The catalog MAY be built lazily (e.g. on first discover or first config load) and MAY be invalidated when config is reloaded (if the server supports config reload).

#### Scenario: Discover returns file flows and OpenAPI flows

- **WHEN** config is loaded with flowsDir and openapi (at least one prefix), and the client calls discover with no keyword (or a keyword that matches some flows)
- **THEN** the tool result SHALL include both file-based flows (flowId = path relative to flowsDir or absolute) and OpenAPI-derived flows (flowId = prefix-operation)
- **AND** the total number of entries SHALL respect the limit parameter (default 10, max 1000)

#### Scenario: Keyword filter applies to both file and OpenAPI flows

- **WHEN** the client calls discover with a keyword
- **THEN** the server SHALL filter the catalog by that keyword (case-insensitive) against: flowId (path or prefix-operation string), flow name, and flow description
- **AND** only matching flows SHALL be returned, still subject to limit

### Requirement: discover SHALL return flowId, name, description, params in Markdown

The discover tool result content SHALL be **Markdown text** (not only JSON). The Markdown SHALL present each flow with at least:

- **flowId**: The identifier to pass to execute (file path or prefix-operation).
- **name**: The flow's name (from flow definition).
- **description**: The flow's description if present; otherwise omit or empty.
- **params**: A summary of the flow's parameters (from flow.params when present). The summary MAY be a list or table of param names and types (and optionally required/default). When the flow has no params declaration, params MAY be omitted or shown as empty.

The format MAY be a Markdown table (e.g. | flowId | name | description | params |) or a list of sections per flow; the server SHALL use a consistent, human-readable format.

#### Scenario: Discover result is Markdown table or list

- **WHEN** the client calls discover and at least one flow is found
- **THEN** the tool result content (text) SHALL be valid Markdown that includes flowId, name, description, and params for each flow
- **AND** the client MAY render it as rich text (e.g. in Cursor)

#### Scenario: No flows found

- **WHEN** the catalog is empty or no flow matches the keyword
- **THEN** the tool result SHALL indicate that no flows were found (e.g. a short Markdown sentence or message), without a table

## Non-requirements (unchanged)

- Execute tool behavior is unchanged by this delta.
- Config reload or cache invalidation strategy is implementation-defined (e.g. cache for process lifetime).
