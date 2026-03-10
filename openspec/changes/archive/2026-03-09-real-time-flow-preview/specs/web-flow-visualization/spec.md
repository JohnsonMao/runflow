## MODIFIED Requirements

### Requirement: Viewer SHALL be read-only

The visualization SHALL be read-only: it SHALL NOT execute the flow, SHALL NOT modify the flow definition, and SHALL NOT persist changes. Interaction MAY include zoom, pan, and optional selection/highlight. In live mode (WebSocket connected), the viewer SHALL dynamically reflect external execution progress and DSL updates but SHALL NOT initiate execution.

#### Scenario: No execution

- **WHEN** the user views a flow graph
- **THEN** the viewer SHALL NOT run or trigger flow execution (except when reflecting real-time updates from an external source)
- **AND** the viewer SHALL NOT require a runflow backend to display the graph

#### Scenario: Optional interaction

- **WHEN** the user interacts with the canvas
- **THEN** the viewer MAY support zoom and pan
- **AND** the viewer MAY support selecting a node or edge for highlight or tooltip
- **AND** the viewer SHALL NOT allow editing step ids, types, or dependsOn through the UI (unless explicitly scoped as a future capability)

## ADDED Requirements

### Requirement: Viewer SHALL support WebSocket connection for live updates

The viewer SHALL support an optional WebSocket connection to receive real-time updates from a CLI `dev` mode server.

#### Scenario: Handle DSL updates via WebSocket

- **WHEN** the viewer receives a `FLOW_RELOAD` message with new graph data
- **THEN** the viewer SHALL re-render the flow graph with the updated nodes and edges
- **AND** the viewer SHALL preserve the current view (zoom/pan) if feasible

#### Scenario: Handle execution status via WebSocket

- **WHEN** the viewer receives a `STEP_STATE_CHANGE` message with a step ID and new status
- **THEN** the viewer SHALL visually update the corresponding node's state (e.g., color, progress bar, icon)
- **AND** the status update SHALL be applied without re-rendering the entire graph structure
