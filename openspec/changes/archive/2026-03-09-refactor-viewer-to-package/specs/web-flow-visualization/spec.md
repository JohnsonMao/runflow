## ADDED Requirements

### Requirement: Viewer SHALL support WebSocket connection for live updates
The Viewer application SHALL be capable of establishing a WebSocket connection to a server for receiving real-time updates of flow definitions and execution states.

#### Scenario: Receive complete flow context via WebSocket
- **WHEN** the Viewer is initialized with a `ws` parameter
- **THEN** it SHALL wait for a `FLOW_RELOAD` message via WebSocket
- **AND** it SHALL use the provided `params`, `graph`, and `flowId` from the message to render the UI, bypassing initial REST API calls for these details
