# flow-graph-format Specification

## Purpose

定義 flow 圖的共用資料格式（nodes、edges 及可選 metadata），供 CLI 輸出與 Web 可視化一致使用；僅描述格式與語意，不綁定實作。

## ADDED Requirements

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

### Requirement: Node SHALL include id and MAY include type and label

Each node SHALL have an `id` (string) equal to the step id. A node MAY include `type` (string, step type) and `label` (string, display label; default may be id or "id (type)").

#### Scenario: Node has required id

- **WHEN** a graph is produced for a flow
- **THEN** every node SHALL have a property `id` that matches the step id
- **AND** node ids SHALL be unique within the graph

#### Scenario: Node may include type for display

- **WHEN** the producer includes step type in the graph
- **THEN** a node MAY have a `type` property (string)
- **AND** a node MAY have a `label` property for display (e.g. "fetch (http)")

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
