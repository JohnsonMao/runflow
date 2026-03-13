## ADDED Requirements

### Requirement: Viewer SHALL support dynamic canvas resizing
The web visualization SHALL allow the canvas to resize and re-center (fitView) when the execution sidebar opens or closes.

#### Scenario: Resize canvas with sidebar toggle
- **WHEN** the Sidebar is opened (e.g., manually or during execution)
- **THEN** the viewer SHALL reduce its available width and adjust the React Flow canvas
- **AND** the viewer SHALL optionally call `fitView` to keep the graph centered

## MODIFIED Requirements

### Requirement: Viewer SHALL be read-only
The visualization SHALL be read-only: it SHALL NOT execute the flow, SHALL NOT modify the flow definition, and SHALL NOT persist changes. Interaction MAY include zoom, pan, and optional selection/highlight. In live mode (WebSocket connected), the viewer SHALL dynamically reflect external execution progress and DSL updates but SHALL NOT initiate execution. (Note: Only `RUN` command from client is allowed via WebSocket).

#### Scenario: No execution results popup
- **WHEN** the flow run completes in the viewer (live mode)
- **THEN** the viewer SHALL NOT display a modal dialog (ResultDialog)
- **AND** the viewer SHALL instead rely on the Sidebar Log Panel for execution results
