## 1. Contract verification

- [x] 1.1 Verify discover_flow_detail returns flow detail including params (and steps) in response; add or extend test that asserts params appear in output for a flow with params
- [x] 1.2 Verify executor_flow accepts optional params and passes them to run(); confirm runFlowInputSchema and execute path include params
- [x] 1.3 Document for implementers: flow graph can be obtained via CLI `flow view --output json` or by deriving from FlowDefinition per flow-graph-format

## 2. Implementer guidance

- [x] 2.1 Add implementer note (e.g. in openspec/specs/flow-review-ui or README) that references flow-review-ui spec and lists data sources: discover_flow_list / discover_flow_detail for list and detail (params, steps), executor_flow for execution with params, and flow view --output json (or FlowDefinition) for graph

## 3. Optional: structured flow detail for UI

- [ ] 3.1 Consider extending discover_flow_detail (or adding an option) to return structured entry (flowId, name, description, params, steps) as JSON so flow-review-ui clients can render params form without parsing markdown; implement only if a consumer in or outside repo needs it (deferred: no consumer requires it yet; implementer note references this as future option)
