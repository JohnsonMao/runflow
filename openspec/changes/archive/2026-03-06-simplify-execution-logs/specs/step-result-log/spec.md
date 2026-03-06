## MODIFIED Requirements

### Requirement: Step logs for execution flow
Steps SHALL return a `log` string as part of their result to provide execution context to the user.

#### Scenario: Success with log
- **WHEN** a step completes successfully and provides a non-empty `log`
- **THEN** the system SHALL capture the log for display in the run summary

#### Scenario: Success without log
- **WHEN** a step completes successfully but provides an empty or null `log`
- **THEN** the system SHALL NOT display this step in the default run summary to reduce noise
