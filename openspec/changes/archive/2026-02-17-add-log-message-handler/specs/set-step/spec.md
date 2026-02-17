# set-step Delta (add-log-message-handler)

## ADDED Requirements

### Requirement: Set step handler SHALL NOT set log on StepResult

The set handler SHALL return StepResult without setting the `log` field. Set steps are for assigning variables into context; display lines SHALL be emitted explicitly via the `message` step type.

#### Scenario: Set step result has no log

- **WHEN** a set step runs and the handler returns stepResult(step.id, true, { outputs: { ... } })
- **THEN** the returned StepResult SHALL NOT include a `log` property (or log SHALL be undefined)
- **AND** CLI --verbose and MCP display SHALL show only the step id and success badge for that step, with no log line
