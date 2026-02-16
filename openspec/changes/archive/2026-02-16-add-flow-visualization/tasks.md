## 1. Graph format and builder

- [x] 1.1 Define flow-graph types (nodes, edges) per flow-graph-format and add function FlowDefinition → graph in core or workspace
- [x] 1.2 Add unit tests for graph builder (linear chain, parallel branches, orphan steps excluded)

## 2. Mermaid and JSON serialization

- [x] 2.1 Implement graph-to-Mermaid (flowchart TB, nodes by id/type, edges dependency → dependent)
- [x] 2.2 Implement graph-to-JSON (flow-graph-format: nodes, edges, optional flowName/flowDescription)

## 3. CLI view command

- [x] 3.1 Add `view` subcommand to CLI with flowId argument and options --output mermaid|json, --config
- [x] 3.2 Wire resolveAndLoadFlow → build graph → output by format; emit error and non-zero exit when flow not found
- [x] 3.3 Add CLI tests for view (default Mermaid, --output json, flow not found)

## 4. Web app setup

- [x] 4.1 Create apps/flow-viewer (Vite + React + React Flow), minimal layout and dependency list
- [x] 4.2 Accept graph.json input (upload or paste) and render DAG with React Flow; node labels id/type
- [x] 4.3 Optional: accept FlowDefinition (YAML or JSON) and derive graph for display
