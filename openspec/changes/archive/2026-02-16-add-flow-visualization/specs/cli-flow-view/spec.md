# cli-flow-view Specification

## Purpose

CLI 子指令（如 `flow view <flowId>`）可輸出 flow 的圖形表示；支援輸出格式為 Mermaid（預設）或 graph.json，與 run/list/detail 共用 resolve 與 config 規則。

## ADDED Requirements

### Requirement: CLI SHALL provide a view command

The CLI SHALL provide a subcommand (e.g. `view`) that accepts a flowId (file path or prefix-operation as in run/list/detail) and outputs the flow's graph. Resolution and config SHALL follow the same rules as the run command (e.g. `--config`, cwd, flowsDir, OpenAPI flows from config).

#### Scenario: View resolves flow by path

- **WHEN** the user runs `flow view path/to/flow.yaml` and the file exists and is valid
- **THEN** the CLI SHALL resolve and load the flow
- **AND** the CLI SHALL output the graph in the requested format (default Mermaid)

#### Scenario: View resolves flow by prefix-operation

- **WHEN** the user runs `flow view my-api-get-users` and config defines an OpenAPI flow with that operation
- **THEN** the CLI SHALL resolve and load the flow as for run
- **AND** the CLI SHALL output the graph in the requested format

#### Scenario: View fails when flow not found

- **WHEN** the flowId cannot be resolved or the file is missing
- **THEN** the CLI SHALL emit an error message and exit with non-zero
- **AND** no graph output SHALL be written to stdout

### Requirement: View SHALL support Mermaid output

The view command SHALL support output format Mermaid (e.g. `--output mermaid` or default). The output SHALL be valid Mermaid flowchart syntax (e.g. flowchart TB), with nodes for each DAG step and edges representing dependsOn (dependency → dependent).

#### Scenario: Default output is Mermaid

- **WHEN** the user runs `flow view flow.yaml` with no output option
- **THEN** the CLI SHALL print Mermaid flowchart text to stdout
- **AND** the output SHALL be pasteable into Mermaid-supported editors or Mermaid Live

#### Scenario: Mermaid nodes and edges match DAG

- **WHEN** a flow has steps A (root) and B with dependsOn [A]
- **THEN** the Mermaid output SHALL include nodes for A and B and an edge from A to B
- **AND** orphan steps SHALL NOT appear in the Mermaid output

### Requirement: View SHALL support JSON graph output

The view command SHALL support output format JSON (e.g. `--output json`) that conforms to the flow-graph-format spec: nodes array and edges array, with optional flowName/flowDescription.

#### Scenario: JSON output conforms to flow-graph-format

- **WHEN** the user runs `flow view flow.yaml --output json`
- **THEN** the CLI SHALL print a single JSON object to stdout
- **AND** the object SHALL contain `nodes` (array) and `edges` (array)
- **AND** each node SHALL have `id`; each edge SHALL have `source` and `target`

#### Scenario: JSON is machine-readable

- **WHEN** the output is JSON
- **THEN** the output SHALL be valid JSON (e.g. parseable by JSON.parse)
- **AND** the CLI SHALL NOT mix non-JSON text (e.g. log messages) with the JSON on stdout
