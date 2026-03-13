## ADDED Requirements

### Requirement: Workspace Status Retrieval
The viewer server SHALL provide an endpoint to retrieve the current workspace status, including root directory and configuration status.

#### Scenario: Successful status retrieval
- **WHEN** a GET request is made to `/api/workspace/status`
- **THEN** the system returns a 200 OK response with a JSON body containing `workspaceRoot`, `configPath`, and `configured` status.

### Requirement: Workspace Flow Tree Retrieval
The viewer server SHALL provide an endpoint to retrieve the hierarchical structure of flows (files and folders) within the workspace.

#### Scenario: Successful tree retrieval
- **WHEN** a GET request is made to `/api/workspace/tree`
- **THEN** the system returns a 200 OK response with a JSON body containing the workspace tree and tag tree structures.

### Requirement: Flow Execution and Broadcast
The viewer server SHALL execute flows upon request and broadcast the execution state (start, step change, validation errors) to all connected WebSocket clients.

#### Scenario: Successful flow execution with broadcasting
- **WHEN** a POST request is made to `/api/workspace/run` with a valid `flowId`
- **THEN** the system SHALL execute the flow and broadcast `FLOW_START` followed by `STEP_STATE_CHANGE` for each executed step to WebSocket clients.
