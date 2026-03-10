## ADDED Requirements

### Requirement: CLI SHALL support hosting static viewer assets
The CLI MUST be able to start an internal HTTP server to serve the static assets of the flow-viewer application.

#### Scenario: Start static server on dev command
- **WHEN** the `flow dev` command is executed
- **THEN** the CLI SHALL start an HTTP server in addition to the WebSocket server
- **AND** the HTTP server SHALL serve files from the viewer's distribution directory

### Requirement: CLI SHALL prioritize local viewer for --open
When the `--open` flag is used with the `dev` command, the CLI SHALL open the locally hosted viewer URL by default.

#### Scenario: Open local viewer
- **WHEN** `flow dev <flowId> --open` is executed
- **THEN** the CLI SHALL determine the local HTTP server address
- **AND** the CLI SHALL open the browser pointing to the local address with the appropriate WebSocket connection parameters
