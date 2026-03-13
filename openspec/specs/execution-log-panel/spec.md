# execution-log-panel Specification

## Purpose

TBD - created by archiving change 'optimize-execution-ui'. Update Purpose after archive.

## Requirements

### Requirement: Execution Log Panel SHALL display real-time step updates
The system SHALL provide a dedicated panel to display the execution log of each step in the flow.

#### Scenario: Display step output when completed
- **WHEN** a `STEP_STATE_CHANGE` message is received with status `success` or `failure`
- **THEN** the Execution Log Panel SHALL append a new entry containing the `stepId`, `status`, and `outputs` (if any)
- **AND** the panel SHALL automatically scroll to the bottom to show the latest entry


<!-- @trace
source: optimize-execution-ui
updated: 2026-03-14
code:
  - packages/viewer/server/index.ts
  - packages/viewer/server/workspace-handlers.ts
  - packages/viewer/server/watcher.ts
  - apps/cli/src/dev.ts
  - packages/viewer/src/types.ts
  - packages/viewer/server/state.ts
  - packages/viewer/package.json
  - packages/viewer/src/App.tsx
  - packages/viewer/server/execution.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/server/workspace-api.ts
  - packages/viewer/server/app.ts
tests:
  - packages/viewer/server/workspace-api.test.ts
  - packages/viewer/server/execution.test.ts
  - packages/viewer/src/hooks/use-websocket.test.ts
  - packages/viewer/server/workspace-handlers.test.ts
  - packages/viewer/server/state.test.ts
-->

---
### Requirement: Execution Log Panel SHALL be accessible via a Sidebar
The system SHALL replace the existing Params Sheet with a Sidebar that contains both "Parameters" and "Logs" tabs.

#### Scenario: Auto-switch to Logs tab on execution start
- **WHEN** the user initiates a flow run (either via `RUN` command or `FLOW_START` message)
- **THEN** the Sidebar SHALL open automatically if it was closed
- **AND** the Sidebar SHALL switch to the "Logs" tab to show real-time progress

<!-- @trace
source: optimize-execution-ui
updated: 2026-03-14
code:
  - packages/viewer/server/index.ts
  - packages/viewer/server/workspace-handlers.ts
  - packages/viewer/server/watcher.ts
  - apps/cli/src/dev.ts
  - packages/viewer/src/types.ts
  - packages/viewer/server/state.ts
  - packages/viewer/package.json
  - packages/viewer/src/App.tsx
  - packages/viewer/server/execution.ts
  - packages/viewer/src/hooks/use-websocket.ts
  - packages/viewer/server/workspace-api.ts
  - packages/viewer/server/app.ts
tests:
  - packages/viewer/server/workspace-api.test.ts
  - packages/viewer/server/execution.test.ts
  - packages/viewer/src/hooks/use-websocket.test.ts
  - packages/viewer/server/workspace-handlers.test.ts
  - packages/viewer/server/state.test.ts
-->