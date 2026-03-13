# viewer-workspace-api Specification

## Purpose

TBD - created by archiving change 'refactor-viewer-and-add-tests'. Update Purpose after archive.

## Requirements

### Requirement: Workspace Status Retrieval
The viewer server SHALL provide an endpoint to retrieve the current workspace status, including root directory and configuration status.

#### Scenario: Successful status retrieval
- **WHEN** a GET request is made to `/api/workspace/status`
- **THEN** the system returns a 200 OK response with a JSON body containing `workspaceRoot`, `configPath`, and `configured` status.


<!-- @trace
source: refactor-viewer-and-add-tests
updated: 2026-03-14
code:
  - packages/viewer/src/types.ts
  - packages/viewer/server/watcher.ts
  - packages/viewer/package.json
  - packages/viewer/server/app.ts
  - packages/viewer/server/workspace-api.ts
  - apps/cli/src/dev.ts
  - packages/viewer/server/index.ts
  - packages/viewer/server/state.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/server/workspace-handlers.ts
  - packages/viewer/server/execution.ts
  - packages/viewer/src/App.tsx
tests:
  - packages/viewer/src/hooks/use-websocket.test.ts
  - packages/viewer/server/workspace-api.test.ts
  - packages/viewer/server/workspace-handlers.test.ts
  - packages/viewer/server/execution.test.ts
  - packages/viewer/server/state.test.ts
-->

---
### Requirement: Workspace Flow Tree Retrieval
The viewer server SHALL provide an endpoint to retrieve the hierarchical structure of flows (files and folders) within the workspace.

#### Scenario: Successful tree retrieval
- **WHEN** a GET request is made to `/api/workspace/tree`
- **THEN** the system returns a 200 OK response with a JSON body containing the workspace tree and tag tree structures.


<!-- @trace
source: refactor-viewer-and-add-tests
updated: 2026-03-14
code:
  - packages/viewer/src/types.ts
  - packages/viewer/server/watcher.ts
  - packages/viewer/package.json
  - packages/viewer/server/app.ts
  - packages/viewer/server/workspace-api.ts
  - apps/cli/src/dev.ts
  - packages/viewer/server/index.ts
  - packages/viewer/server/state.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/server/workspace-handlers.ts
  - packages/viewer/server/execution.ts
  - packages/viewer/src/App.tsx
tests:
  - packages/viewer/src/hooks/use-websocket.test.ts
  - packages/viewer/server/workspace-api.test.ts
  - packages/viewer/server/workspace-handlers.test.ts
  - packages/viewer/server/execution.test.ts
  - packages/viewer/server/state.test.ts
-->

---
### Requirement: Flow Execution and Broadcast
The viewer server SHALL execute flows upon request and broadcast the execution state (start, step change, validation errors) to all connected WebSocket clients.

#### Scenario: Successful flow execution with broadcasting
- **WHEN** a POST request is made to `/api/workspace/run` with a valid `flowId`
- **THEN** the system SHALL execute the flow and broadcast `FLOW_START` followed by `STEP_STATE_CHANGE` for each executed step to WebSocket clients.

<!-- @trace
source: refactor-viewer-and-add-tests
updated: 2026-03-14
code:
  - packages/viewer/src/types.ts
  - packages/viewer/server/watcher.ts
  - packages/viewer/package.json
  - packages/viewer/server/app.ts
  - packages/viewer/server/workspace-api.ts
  - apps/cli/src/dev.ts
  - packages/viewer/server/index.ts
  - packages/viewer/server/state.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/server/workspace-handlers.ts
  - packages/viewer/server/execution.ts
  - packages/viewer/src/App.tsx
tests:
  - packages/viewer/src/hooks/use-websocket.test.ts
  - packages/viewer/server/workspace-api.test.ts
  - packages/viewer/server/workspace-handlers.test.ts
  - packages/viewer/server/execution.test.ts
  - packages/viewer/server/state.test.ts
-->