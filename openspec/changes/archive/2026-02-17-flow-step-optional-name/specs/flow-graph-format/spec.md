# flow-graph-format (delta)

## MODIFIED Requirements

### Requirement: Node SHALL include id and MAY include type, label, and description

Each node SHALL have an `id` (string) equal to the step id. A node MAY include `type` (string, step type). The node's `label` (string, display label) SHALL be the step's `name` when the step has a `name` field; when the step has no `name`, the producer SHALL use a fallback such as the step id or "id (type)". A node MAY include `description` (string) when the step has a `description` field; when present, it SHALL be the step's description for use in tooltips or detail views.

#### Scenario: Node has required id

- **WHEN** a graph is produced for a flow
- **THEN** every node SHALL have a property `id` that matches the step id
- **AND** node ids SHALL be unique within the graph

#### Scenario: Node label uses step name when present

- **WHEN** a step has `id: 'fetch'`, `type: 'http'`, and `name: 'Fetch user'`
- **THEN** the corresponding node SHALL have `label` equal to the step's `name` (e.g. "Fetch user")
- **AND** the node MAY include `type: 'http'`

#### Scenario: Node label fallback when step has no name

- **WHEN** a step has `id: 'fetch'`, `type: 'http'`, and no `name`
- **THEN** the corresponding node SHALL have a `label` that is a fallback (e.g. "fetch (http)" or "fetch")
- **AND** the producer SHALL NOT require step.name to be set

#### Scenario: Node may include description from step

- **WHEN** a step has `description: 'Calls the user API.'`
- **THEN** the corresponding node MAY have a `description` property (string) set to the step's description
- **AND** consumers MAY use it for tooltips or detail views

#### Scenario: Node without step description

- **WHEN** a step has no `description`
- **THEN** the node MAY omit the `description` property
- **AND** consumers SHALL treat missing description as no step-level description available
