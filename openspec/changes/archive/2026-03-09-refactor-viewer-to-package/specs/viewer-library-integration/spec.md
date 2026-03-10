## ADDED Requirements

### Requirement: Viewer SHALL be available as a library
The `@runflow/viewer` package SHALL export a function to start its server programmatically.

#### Scenario: Export startServer function
- **WHEN** the `@runflow/viewer` package is imported by another module (like CLI)
- **THEN** it SHALL provide an async `startServer` function
- **AND** this function SHALL accept configuration options such as `port`, `workspaceConfig`, and `staticPath`

### Requirement: Viewer Server SHALL use shared workspace logic
The Viewer's internal server SHALL rely on the `@runflow/workspace` package for all flow ID resolution and file scanning.

#### Scenario: Resolve flow ID consistently
- **WHEN** the Viewer Server receives a request for a flow detail by ID
- **THEN** it SHALL use the same `resolveFlowId` logic as the CLI to locate the file
- **AND** the result SHALL be consistent across both tools
