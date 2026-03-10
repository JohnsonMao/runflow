## ADDED Requirements

### Requirement: CLI SHALL provide a dev command for hot reload
The CLI MUST support a `dev` command that listens for file changes in the specified flow definition and triggers a reload.

#### Scenario: Trigger reload on file change
- **WHEN** a user modifies the flow.yaml file during `flow dev` execution
- **THEN** the CLI SHALL re-parse the flow definition
- **AND** the CLI SHALL notify connected viewers via WebSocket

### Requirement: CLI SHALL embed a WebSocket server for status push
The CLI MUST run a WebSocket server during `dev` mode to communicate with the viewer.

#### Scenario: Push step status updates
- **WHEN** a step execution state changes (e.g., started, completed)
- **THEN** the CLI SHALL broadcast the status change to all connected WebSocket clients
