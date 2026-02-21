# flow-review-ui — Implementer note

This document is for implementers of the **flow-review-ui** capability (see [spec](./spec.md) when synced, or the delta spec under `openspec/changes/flow-review-params-execute/specs/flow-review-ui/spec.md)).

## Data sources

- **Flow list**: Use **discover_flow_list** (MCP) or `buildDiscoverCatalog` + pagination (workspace) to get flowId, name, and type.
- **Flow detail (params, steps)**: Use **discover_flow_detail** (MCP) or **getDiscoverEntry**(catalog, flowId) (workspace). The response/detail includes the flow’s **params** declaration and **steps** summary. For flow-review-ui, show params so the user can fill them in; show steps for context.  
  - **Note**: Today discover_flow_detail returns **Markdown** text. To render a params form from structured data, you can use getDiscoverEntry in-process, or a future optional JSON response from discover_flow_detail (see change task 3.1).
- **Flow graph**: Use one of:
  - **CLI**: `flow view <flowId> --output json` to get the graph in **flow-graph-format** (nodes + edges).
  - **In-process**: Load the flow (e.g. via workspace resolve + core loader), then derive the graph from the FlowDefinition using the same rules as flow-graph-format (DAG steps only; edges from dependency to dependent).
- **Execution**: Use **executor_flow** (MCP) with `flowId` and optional **params** (key-value object). Params are validated by the server per flow-params-schema; return success/failure and result or error to the user.

## Summary

| Need        | Source |
|------------|--------|
| List flows | discover_flow_list / buildDiscoverCatalog |
| Detail + params + steps | discover_flow_detail / getDiscoverEntry |
| Graph      | CLI `flow view --output json` or derive from FlowDefinition (flow-graph-format) |
| Run flow   | executor_flow(flowId, params?) |
