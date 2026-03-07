## MODIFIED Requirements

### Requirement: Flow review SHALL show flow graph when a flow is selected

When the user selects a single flow (e.g. by flowId from a list or discover catalog), the flow review interface SHALL display that flow's graph. The graph SHALL be produced from flow-graph-format (nodes and edges) or from FlowDefinition using the same rules as flow-graph-format. The interface SHALL NOT require a new graph format; it SHALL use the same format as CLI `flow view --output json` or equivalent derivation from FlowDefinition.

#### Scenario: Display graph from discover or resolved flow
- **WHEN** the user has selected a flow and the client has graph data (flow-graph-format) or FlowDefinition for that flow
- **THEN** the flow review interface SHALL render the flow graph (nodes and edges)
- **AND** the sidebar SHALL automatically expand and highlight the corresponding entry (even for OpenAPI or custom ID flows)

### Requirement: Flow review SHALL allow the user to supply params and trigger execution

The interface SHALL provide a way for the user to enter or edit parameter values (according to the flow's params declaration) and SHALL provide an explicit action (e.g. "Run" or "Execute") to run the selected flow with those params. When the user triggers execution, the client SHALL call the execution endpoint (e.g. MCP executor_flow or equivalent) with the current flowId and the user-supplied params. The interface SHALL display the execution result or error to the user.

#### Scenario: Execute with user-supplied params
- **WHEN** the user has selected a flow, optionally filled in params, and triggers execution
- **THEN** the client SHALL invoke the execution mechanism (e.g. executor_flow) with flowId and params
- **AND** the interface SHALL show success or failure and result or error content to the user
- **AND** the user-supplied params SHALL be persisted in the URL to survive page refreshes

## ADDED Requirements

### Requirement: Sidebar Navigation Modes
The flow review interface SHALL support switching between Folder View and Tag View in the sidebar.

#### Scenario: Switch to Tag View
- **WHEN** the user selects the "Tags" tab in the sidebar
- **THEN** the sidebar SHALL display flows grouped by their tags
- **AND** the selection state SHALL be synchronized across both views
