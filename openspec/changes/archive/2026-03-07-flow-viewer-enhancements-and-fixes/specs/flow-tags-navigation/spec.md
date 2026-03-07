## ADDED Requirements

### Requirement: Flow tags definition
The `FlowDefinition` SHALL support an optional `tags` property of type `string[]`.

#### Scenario: Flow with tags
- **WHEN** a Flow YAML includes a `tags` array (e.g., `tags: ["Production", "Core"]`)
- **THEN** the system SHALL parse and make these tags available in the `DiscoverEntry`

### Requirement: Sidebar Tag View
The `flow-viewer` sidebar SHALL support a "Tag View" mode that displays flows grouped by tags.

#### Scenario: Tag grouping in sidebar
- **WHEN** the Tag View is active
- **THEN** each unique tag SHALL be displayed as a virtual folder
- **AND** a flow SHALL appear within every virtual folder corresponding to its tags
- **AND** flows without tags SHALL be grouped under an "Untagged" virtual folder

### Requirement: Tag View tab switching
The `flow-viewer` sidebar SHALL include a persistent tab or toggle to switch between Folder View and Tag View.

#### Scenario: Tab switching
- **WHEN** the user clicks the "Tags" tab
- **THEN** the sidebar SHALL display the Tag-based virtual tree
- **AND** this choice SHALL be persisted in local storage or URL if possible
