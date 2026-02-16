# flow-viewer-workspace Specification

## Purpose

定義 flow-viewer 應用與工作區的整合：使用者可設定 flowDir/工作區（與 CLI、MCP 共用 runflow.config 語意）、取得 flow 列表（discover）、選擇單一 flow 並檢視其流程圖；UI 以 shadcn 為準。

## ADDED Requirements

### Requirement: flow-viewer SHALL support workspace configuration

The flow-viewer SHALL support a workspace root (flowDir or flowsDir from runflow.config) so that flow discovery and graph resolution use the same semantics as @runflow/workspace. The source of the workspace path (e.g. environment variable or backend config) is implementation-defined; the viewer SHALL use it to obtain config and catalog from the same rules as CLI and MCP (findConfigFile, loadConfig, buildDiscoverCatalog).

#### Scenario: Workspace is used for discovery and graph

- **WHEN** the user has configured a valid workspace root and the backend has access to that path
- **THEN** the flow-viewer SHALL use that workspace to resolve runflow.config (runflow.config.mjs, .js, .json) and flowsDir
- **AND** list and graph data SHALL be produced using the same resolution rules as the CLI view command (resolveFlowId, flow-graph-format)

#### Scenario: User can see current workspace indication

- **WHEN** the flow-viewer has a configured workspace
- **THEN** the UI SHALL indicate the current workspace (e.g. path or label) so the user knows which directory is in use
- **AND** when no workspace is configured or config is missing, the UI SHALL show an actionable message (e.g. configure FLOW_VIEWER_WORKSPACE_ROOT or equivalent)

### Requirement: flow-viewer SHALL display a list of flows and allow selection

The flow-viewer SHALL fetch and display a list of flows (discover catalog) from the configured workspace. The list SHALL include at least flowId and name per entry (DiscoverEntry shape). The user SHALL be able to select one flow from the list to view its graph.

#### Scenario: List shows flows from workspace catalog

- **WHEN** the workspace is configured and the list API returns successfully
- **THEN** the flow-viewer SHALL display the list of flows (e.g. in a sidebar or dropdown)
- **AND** each list item SHALL show at least the flow identifier (flowId) and the flow name when available

#### Scenario: Selecting a flow loads its graph

- **WHEN** the user selects a flow from the list
- **THEN** the flow-viewer SHALL request that flow's graph (flow-graph-format) from the backend
- **AND** the flow-viewer SHALL render the graph in the main viewing area according to web-flow-visualization (read-only, nodes and edges)

### Requirement: flow-viewer SHALL render the selected flow graph in flow-graph-format

The flow-viewer SHALL accept the graph for the selected flow in flow-graph-format (nodes and edges) and SHALL render it using the same behavior as web-flow-visualization: directed graph, node labels (step id and optionally type), zoom/pan allowed, read-only (no execution, no editing).

#### Scenario: Graph from workspace is displayed correctly

- **WHEN** the user has selected a flow and the backend returns a flow-graph-format payload
- **THEN** the viewer SHALL render nodes and edges as specified in flow-graph-format and web-flow-visualization
- **AND** the layout SHALL be readable (e.g. hierarchical or automatic layout)

### Requirement: flow-viewer UI SHALL use shadcn for layout and controls

The flow-viewer SHALL use shadcn (or equivalent shadcn-based component set) for layout and controls. Standard UI elements such as sidebar, buttons, forms, selects, and lists SHALL be implemented with shadcn components where applicable; the app SHALL NOT implement custom equivalents for such standard components when shadcn provides them.

#### Scenario: Layout and controls come from shadcn

- **WHEN** the flow-viewer implements workspace indication, flow list, flow selection, or navigation
- **THEN** those elements SHALL use shadcn components (e.g. Sidebar, Button, Select, Card) rather than ad-hoc custom components
- **AND** styling SHALL follow the project's shadcn/ Tailwind theme so that the UI is consistent and maintainable
