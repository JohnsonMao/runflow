## ADDED Requirements

### Requirement: Execution Engine SHALL support runtime life-cycle hooks

The core execution engine (e.g., in `packages/core/executor.ts`) SHALL allow registration of callbacks or hooks to track the runtime progress and state transitions of a flow and its individual steps.

#### Scenario: Register and trigger step state hooks

- **WHEN** a hook is registered for step state changes
- **AND** a step transitions (e.g., from `pending` to `running`, `running` to `success` or `failure`)
- **THEN** the execution engine SHALL call the registered hook with the current step ID, its new state, and relevant metadata (e.g., duration, output, or error)

#### Scenario: Multiple hooks support

- **WHEN** multiple hooks are registered for flow execution
- **THEN** the execution engine SHALL call all registered hooks in the order they were registered when a transition occurs

### Requirement: Execution Engine SHALL NOT block flow completion due to hook execution

Hooks SHALL be executed in a non-blocking manner or with minimal impact on the flow's execution flow.

#### Scenario: Hook error isolation

- **WHEN** a registered hook throws an error or fails during execution
- **THEN** the execution engine SHALL catch and log the error but continue executing the flow's remaining steps and other hooks
