## ADDED Requirements

### Requirement: Custom Flow ID definition
The `FlowDefinition` SHALL support an optional `id` property of type string.

#### Scenario: Flow with custom ID
- **WHEN** a Flow YAML includes an `id` field (e.g., `id: my-flow`)
- **THEN** the system SHALL use this value as the primary `flowId` for execution and display
- **AND** the file path SHALL be preserved as a secondary identifier for internal resolution

### Requirement: Global Flow ID uniqueness
Every `flowId` in a workspace (whether derived from file path, OpenAPI operation, or custom `id`) SHALL be unique.

#### Scenario: Duplicate custom ID detection
- **WHEN** two or more flows define the same `id` value
- **THEN** the workspace loader SHALL record a critical error identifying the conflicting files
- **AND** the `flow-viewer` SHALL display a global error message on startup if duplicates are found
- **AND** the `mcp-server` SHALL log the error to stderr but continue loading other valid flows

### Requirement: ID priority in navigation
The system SHALL prioritize the custom `id` over the file path when generating links and breadcrumbs.

#### Scenario: Navigation with custom ID
- **WHEN** a flow has both a file path `basic/test.yaml` and an `id: login-test`
- **THEN** the URL parameter `?flowId=login-test` SHALL be used to identify and load the flow
- **AND** the sidebar SHALL mark the corresponding entry as active based on this ID
