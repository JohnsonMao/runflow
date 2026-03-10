## ADDED Requirements

### Requirement: CLI SHALL provide a dev command for hot reload

The CLI SHALL provide a subcommand (e.g., `dev`) that accepts a flow path, monitors the file for changes, and provides a real-time preview via an embedded WebSocket server.

#### Scenario: Start dev mode with file watcher

- **WHEN** the user runs `runflow dev path/to/flow.yaml`
- **THEN** the CLI SHALL resolve the flow and start an HTTP/WebSocket server
- **AND** the CLI SHALL watch the target file for any modifications

#### Scenario: Push DSL update on file change

- **WHEN** the target flow file is modified and saved
- **THEN** the CLI SHALL re-parse the flow definition
- **AND** the CLI SHALL broadcast a `FLOW_RELOAD` event via WebSocket with the updated graph data

### Requirement: CLI SHALL embed a WebSocket server for status push

The CLI in `dev` mode SHALL maintain an active WebSocket server to broadcast flow execution states and structure updates to connected clients (e.g., `flow-viewer`).

#### Scenario: Broadcast execution state changes

- **WHEN** a step execution status changes (e.g., from pending to running)
- **THEN** the CLI SHALL broadcast a `STEP_STATE_CHANGE` event via WebSocket
- **AND** the event payload SHALL include the step ID, status, and optional output or error data

#### Scenario: Support --open flag

- **WHEN** the user runs `runflow dev` with the `--open` flag
- **THEN** the CLI SHALL attempt to open the default web browser pointing to the `flow-viewer` URL
- **AND** the URL SHALL include connection parameters (e.g., `?ws=localhost:PORT`) for automatic connection
