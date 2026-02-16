# flow-graph-format Specification

## Purpose

定義 flow 圖的共用資料格式（nodes、edges 及可選 metadata），供 CLI 輸出與 Web 可視化一致使用；僅描述格式與語意，不綁定實作。

## Requirements

### Requirement: Graph SHALL have nodes and edges

A flow graph representation SHALL consist of a list of nodes and a list of directed edges. Each node SHALL represent a step that is part of the DAG (has `dependsOn`). Each edge SHALL represent a dependency: from a dependency step to a step that depends on it (edge source = step id that is depended on, edge target = step id that depends on it).

#### Scenario: Minimal graph structure

- **WHEN** a flow has two steps: step A with `dependsOn: []`, step B with `dependsOn: ['A']`
- **THEN** the graph SHALL have two nodes with ids A and B
- **AND** the graph SHALL have one edge with source A and target B

#### Scenario: Orphan steps are excluded from graph

- **WHEN** a flow has a step with no `dependsOn` field (orphan)
- **THEN** that step SHALL NOT appear as a node in the graph
- **AND** no edge SHALL reference that step id as source or target

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

### Requirement: Edge SHALL have source and target

Each edge SHALL have `source` (string) and `target` (string), each a step id. The direction SHALL be "source is dependency of target" (target step has source in its dependsOn).

#### Scenario: Edge direction matches dependsOn

- **WHEN** step B has `dependsOn: ['A']`
- **THEN** there SHALL be an edge with source "A" and target "B"
- **AND** multiple dependencies SHALL produce multiple edges (e.g. C dependsOn ['A','B'] → edges A→C and B→C)

### Requirement: Graph SHALL allow optional flow metadata

The graph representation MAY include optional top-level fields such as `flowName` (string) and `flowDescription` (string) from the FlowDefinition. Consumers SHALL treat these as optional when present.

#### Scenario: Metadata when present

- **WHEN** the producer includes flow metadata
- **THEN** the output MAY include `flowName` and/or `flowDescription`
- **AND** consumers SHALL treat these as optional and MAY use them for display
