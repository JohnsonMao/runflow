# web-flow-visualization Specification

## Purpose

Web 應用或頁面以 React Flow（或同等圖庫）渲染 flow DAG，節點顯示 step id/type 等，邊表示 dependsOn；資料可來自 graph.json 或 FlowDefinition。

## ADDED Requirements

### Requirement: Viewer SHALL render a flow graph from graph.json

The web visualization SHALL accept input in the flow-graph-format (nodes + edges, e.g. from CLI `flow view --output json`). It SHALL render a directed graph where nodes correspond to steps and edges correspond to dependencies (source → target as in the format).

#### Scenario: Load graph from JSON

- **WHEN** the user provides or uploads a graph.json (flow-graph-format)
- **THEN** the viewer SHALL render nodes for each node in the JSON
- **AND** the viewer SHALL render edges for each edge in the JSON
- **AND** the layout SHALL be readable (e.g. hierarchical or automatic layout)

#### Scenario: Node labels show step id and optionally type

- **WHEN** a node has `id` and optionally `type` or `label`
- **THEN** the viewer SHALL display at least the step id on the node
- **AND** the viewer MAY display type or label when present

### Requirement: Viewer MAY accept FlowDefinition

The web visualization MAY accept a FlowDefinition (e.g. parsed flow YAML or JSON). When accepted, the viewer SHALL derive the graph (nodes/edges) according to the same rules as flow-graph-format (DAG steps only, edges from dependency to dependent).

#### Scenario: Derive graph from FlowDefinition

- **WHEN** the user provides a FlowDefinition (e.g. pasted YAML or uploaded file)
- **THEN** the viewer SHALL build the set of nodes from steps that have dependsOn
- **AND** the viewer SHALL build edges from each dependency to the step that depends on it
- **AND** the rendered graph SHALL match what flow-graph-format would produce for the same flow

### Requirement: Viewer SHALL be read-only

The visualization SHALL be read-only: it SHALL NOT execute the flow, SHALL NOT modify the flow definition, and SHALL NOT persist changes. Interaction MAY include zoom, pan, and optional selection/highlight.

#### Scenario: No execution

- **WHEN** the user views a flow graph
- **THEN** the viewer SHALL NOT run or trigger flow execution
- **AND** the viewer SHALL NOT require a runflow backend to display the graph

#### Scenario: Optional interaction

- **WHEN** the user interacts with the canvas
- **THEN** the viewer MAY support zoom and pan
- **AND** the viewer MAY support selecting a node or edge for highlight or tooltip
- **AND** the viewer SHALL NOT allow editing step ids, types, or dependsOn through the UI (unless explicitly scoped as a future capability)
