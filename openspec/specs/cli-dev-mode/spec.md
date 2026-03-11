# cli-dev-mode Specification

## Purpose

TBD - created by archiving change 'real-time-flow-preview'. Update Purpose after archive.

## Requirements

### Requirement: CLI SHALL provide a dev command for hot reload
The CLI SHALL provide a subcommand (e.g., `dev`) that accepts a flow path, monitors the file for changes, and provides a real-time preview via an embedded WebSocket server. The implementation SHALL ensure the viewer receives the initial state immediately upon connection.

#### Scenario: Start dev mode with file watcher
- **WHEN** the user runs `runflow dev path/to/flow.yaml`
- **THEN** the CLI SHALL resolve the flow and start an HTTP/WebSocket server
- **AND** the CLI SHALL watch the target file for any modifications

#### Scenario: Push DSL update on file change
- **WHEN** the target flow file is modified and saved
- **THEN** the CLI SHALL re-parse the flow definition
- **AND** the CLI SHALL broadcast a `FLOW_RELOAD` event via WebSocket with the updated graph data


<!-- @trace
source: hybrid-viewer-replay
updated: 2026-03-11
code:
  - workspace/custom-handler/txn-token-handler.mjs
  - pnpm-workspace.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - workspace/src/promotionRules.ts
  - workspace/config/runflow.config.json
  - workspace/flows/tt/get-users.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - packages/convention-openapi/package.json
  - workspace/custom-handler/scm-handler.mjs
  - workspace/openapi/simple.yaml
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/handlers/package.json
  - apps/cli/src/cli.ts
  - workspace/custom-handler/payments-handler.mjs
  - packages/viewer/src/App.tsx
  - workspace/flows/tt/test.yaml
  - packages/viewer/server/lib/index.ts
  - packages/viewer/server/workspace-api.ts
  - apps/cli/package.json
  - packages/viewer/server/execution.ts
  - workspace/flows/tt/params-count2.json
  - workspace/src/logisticsCenter.ts
  - workspace/flows/tt/get-users-userId.yaml
  - packages/viewer/src/hooks/use-flow-graph.ts
  - packages/viewer/vite.config.ts
  - packages/workspace/package.json
  - apps/cli/src/dev.ts
  - workspace/flows/tt/post-users.yaml
  - packages/core/package.json
  - packages/workspace/src/config.ts
  - packages/viewer/package.json
-->

---
### Requirement: CLI SHALL embed a WebSocket server for status push
The CLI in `dev` mode SHALL maintain an active WebSocket server to broadcast flow execution states and structure updates to connected clients (e.g., `flow-viewer`). The server SHALL push the current state (graph and status) to any client immediately upon successful WebSocket connection (State Replay).

#### Scenario: Broadcast execution state changes
- **WHEN** a step execution status changes (e.g., from pending to running)
- **THEN** the CLI SHALL broadcast a `STEP_STATE_CHANGE` event via WebSocket
- **AND** the event payload SHALL include the step ID, status, and optional output or error data

#### Scenario: Replay state on new connection
- **WHEN** a new WebSocket client connects to the dev server
- **THEN** the server SHALL immediately send the latest `FLOW_RELOAD` message
- **AND** the server SHALL send any active step statuses via `STEP_STATE_CHANGE` messages

#### Scenario: Support --open flag
- **WHEN** the user runs `runflow dev` with the `--open` flag
- **THEN** the CLI SHALL attempt to open the default web browser pointing to the `flow-viewer` URL
- **AND** the URL SHALL include connection parameters (e.g., `?ws=localhost:PORT`) for automatic connection


<!-- @trace
source: hybrid-viewer-replay
updated: 2026-03-11
code:
  - workspace/custom-handler/txn-token-handler.mjs
  - pnpm-workspace.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - workspace/src/promotionRules.ts
  - workspace/config/runflow.config.json
  - workspace/flows/tt/get-users.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - packages/convention-openapi/package.json
  - workspace/custom-handler/scm-handler.mjs
  - workspace/openapi/simple.yaml
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/handlers/package.json
  - apps/cli/src/cli.ts
  - workspace/custom-handler/payments-handler.mjs
  - packages/viewer/src/App.tsx
  - workspace/flows/tt/test.yaml
  - packages/viewer/server/lib/index.ts
  - packages/viewer/server/workspace-api.ts
  - apps/cli/package.json
  - packages/viewer/server/execution.ts
  - workspace/flows/tt/params-count2.json
  - workspace/src/logisticsCenter.ts
  - workspace/flows/tt/get-users-userId.yaml
  - packages/viewer/src/hooks/use-flow-graph.ts
  - packages/viewer/vite.config.ts
  - packages/workspace/package.json
  - apps/cli/src/dev.ts
  - workspace/flows/tt/post-users.yaml
  - packages/core/package.json
  - packages/workspace/src/config.ts
  - packages/viewer/package.json
-->

---
### Requirement: Viewer SHALL fetch initial state regardless of WS presence
The `flow-viewer` SHALL attempt to fetch the flow graph and workspace status via HTTP API even if a WebSocket URL is provided in the query parameters.

#### Scenario: Initial load with WS parameter
- **WHEN** the viewer is opened with `?ws=...&flowId=...`
- **THEN** it SHALL first perform a `fetch` to `/api/workspace/graph`
- **AND** it SHALL concurrently establish the WebSocket connection
- **AND** it SHALL update the UI with the latest data from whichever source (API or WS) arrives first or is more recent

<!-- @trace
source: hybrid-viewer-replay
updated: 2026-03-11
code:
  - workspace/custom-handler/txn-token-handler.mjs
  - pnpm-workspace.yaml
  - workspace/custom-handler/promotion-rules-handler.mjs
  - workspace/src/promotionRules.ts
  - workspace/config/runflow.config.json
  - workspace/flows/tt/get-users.yaml
  - workspace/custom-handler/txn-last-token-handler.mjs
  - packages/convention-openapi/package.json
  - workspace/custom-handler/scm-handler.mjs
  - workspace/openapi/simple.yaml
  - workspace/custom-handler/logistics-center-handler.mjs
  - packages/handlers/package.json
  - apps/cli/src/cli.ts
  - workspace/custom-handler/payments-handler.mjs
  - packages/viewer/src/App.tsx
  - workspace/flows/tt/test.yaml
  - packages/viewer/server/lib/index.ts
  - packages/viewer/server/workspace-api.ts
  - apps/cli/package.json
  - packages/viewer/server/execution.ts
  - workspace/flows/tt/params-count2.json
  - workspace/src/logisticsCenter.ts
  - workspace/flows/tt/get-users-userId.yaml
  - packages/viewer/src/hooks/use-flow-graph.ts
  - packages/viewer/vite.config.ts
  - packages/workspace/package.json
  - apps/cli/src/dev.ts
  - workspace/flows/tt/post-users.yaml
  - packages/core/package.json
  - packages/workspace/src/config.ts
  - packages/viewer/package.json
-->