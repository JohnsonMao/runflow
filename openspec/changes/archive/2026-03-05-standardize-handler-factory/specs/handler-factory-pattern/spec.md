## MODIFIED Requirements

### Requirement: Handlers SHALL be defined via a Factory function

The system SHALL support defining step handlers as a default export of a factory function. This function SHALL receive a context object containing tools (`defineHandler`, `z`, `utils`, etc.) and MUST return a handler configuration using `defineHandler`. The `defineHandler` call MUST include a `type` property (string) that uniquely identifies the step type handled by this handler. The canonical pattern SHALL be: `export default ({ defineHandler }) => defineHandler({ type: 'name', ... })`.

#### Scenario: Basic handler factory definition with type
- **WHEN** a handler file contains `export default ({ defineHandler }) => defineHandler({ type: 'echo', ... })`
- **THEN** the engine SHALL invoke this factory with the required tools
- **AND** the resulting handler configuration SHALL include `type: 'echo'`
- **AND** the handler SHALL be eligible for automatic registration in the step registry via its `type`

## ADDED Requirements

### Requirement: HandlerFactory SHALL be testable without full engine integration

The system SHALL export a `createFactoryContext()` helper from `@runflow/core` (or a dedicated testing utility). Developers SHALL use this helper to create a mock context to invoke the factory function in unit tests. This allows testing the `schema` validation and `run` logic of a handler in isolation from the full flow execution engine.

#### Scenario: Unit testing a handler factory
- **WHEN** a test calls a handler factory with `createFactoryContext()`
- **THEN** it SHALL receive the handler configuration object
- **AND** the test SHALL be able to invoke `handler.run(context)` directly with mock parameters
- **AND** the test SHALL NOT require a running flow engine or a workspace configuration
