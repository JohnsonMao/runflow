# flow-review-ui Specification (Delta)

## Purpose

Flow 檢視介面：當使用者選取單一 flow 時，介面須顯示該 flow 的流程圖、可帶入的 params（依宣告展示並可編輯）、以及手動執行操作；執行時以 flowId 與 params 呼叫執行端並呈現結果。不規定實作技術（MCP 客戶端、Web 應用或 Runflow GUI 皆可）。

## ADDED Requirements

### Requirement: Flow review SHALL show flow graph when a flow is selected

When the user selects a single flow (e.g. by flowId from a list or discover catalog), the flow review interface SHALL display that flow's graph. The graph SHALL be produced from flow-graph-format (nodes and edges) or from FlowDefinition using the same rules as flow-graph-format. The interface SHALL NOT require a new graph format; it SHALL use the same format as CLI `flow view --output json` or equivalent derivation from FlowDefinition.

#### Scenario: Display graph from discover or resolved flow

- **WHEN** the user has selected a flow and the client has graph data (flow-graph-format) or FlowDefinition for that flow
- **THEN** the flow review interface SHALL render the flow graph (nodes and edges)
- **AND** the graph SHALL match the DAG semantics (steps with dependsOn only; edges from dependency to dependent)

#### Scenario: No graph when flow is not selected

- **WHEN** no flow is selected or flow data is unavailable
- **THEN** the interface MAY show an empty state or prompt to select a flow
- **AND** the interface SHALL NOT display a graph for a different flow than the one selected

### Requirement: Flow review SHALL display the flow's params declaration

When a flow is selected, the interface SHALL display the params that the flow accepts. The params SHALL be those declared for the flow (ParamDeclaration[]), as provided by the discover entry or flow definition (name, type, required, default, description, and when applicable enum, schema, items). The interface SHALL present them in a way that allows the user to see what can be passed (e.g. labels, types, required indicator, descriptions).

#### Scenario: Show params from discover entry or flow

- **WHEN** the selected flow has params (e.g. DiscoverEntry.params or flow.params)
- **THEN** the interface SHALL show each param's name and type
- **AND** the interface SHALL indicate required params when the declaration says so
- **AND** the interface MAY show default, description, enum, or schema when present

#### Scenario: No params

- **WHEN** the selected flow has no params or an empty params array
- **THEN** the interface SHALL show that no params are needed (or an empty params section)
- **AND** the user SHALL still be able to trigger execution with no params

### Requirement: Flow review SHALL allow the user to supply params and trigger execution

The interface SHALL provide a way for the user to enter or edit parameter values (according to the flow's params declaration) and SHALL provide an explicit action (e.g. "Run" or "Execute") to run the selected flow with those params. When the user triggers execution, the client SHALL call the execution endpoint (e.g. MCP executor_flow or equivalent) with the current flowId and the user-supplied params. The interface SHALL display the execution result or error to the user.

#### Scenario: Execute with user-supplied params

- **WHEN** the user has selected a flow, optionally filled in params, and triggers execution
- **THEN** the client SHALL invoke the execution mechanism (e.g. executor_flow) with flowId and params
- **AND** the interface SHALL show success or failure and result or error content to the user

#### Scenario: Execute with no params when flow has no required params

- **WHEN** the flow has no params or no required params and the user triggers execution without filling any params
- **THEN** the client SHALL invoke execution with flowId and an empty or omitted params object
- **AND** execution SHALL proceed according to flow-params-schema and executor semantics

#### Scenario: Validation errors from execution

- **WHEN** the user triggers execution and the execution endpoint returns a validation error (e.g. missing required param, type mismatch)
- **THEN** the interface SHALL display the error to the user
- **AND** the interface MAY allow the user to correct params and retry

### Requirement: Flow review SHALL use existing data and execution APIs

The flow review interface SHALL obtain flow list and flow detail (including params and steps) from existing discovery or workspace APIs (e.g. discover_flow_list, discover_flow_detail, buildDiscoverCatalog, getDiscoverEntry). It SHALL obtain graph data from flow-graph-format or FlowDefinition (e.g. CLI flow view --output json or equivalent). It SHALL trigger execution only through existing execution APIs (e.g. MCP executor_flow or @runflow/core run()). The interface SHALL NOT define or require new backend endpoints for list, detail, graph, or execution.

#### Scenario: Detail and params from discover

- **WHEN** the client needs to show flow detail and params for a selected flowId
- **THEN** it SHALL use discover_flow_detail or getDiscoverEntry (or equivalent) to get entry with params and steps
- **AND** it SHALL NOT assume a new API that returns "flow review payload"

#### Scenario: Execution via existing executor

- **WHEN** the user triggers execution
- **THEN** the client SHALL call executor_flow (or equivalent run(flow, { params })) with flowId and params
- **AND** params validation and run semantics SHALL follow flow-params-schema and core executor
