## MODIFIED Requirements

### Requirement: Step execution logging
The HTTP handler SHALL provide execution details in the step log.

#### Scenario: Success logging
- **WHEN** an HTTP request completes successfully (e.g., 2xx status)
- **THEN** the log SHALL contain the method, URL, and status code (e.g., `GET https://... → 200`)
- **AND** the log SHALL NOT contain the response body by default to maintain brevity in the CLI summary

#### Scenario: Error logging
- **WHEN** an HTTP request fails or returns a non-success status code
- **THEN** the log SHALL contain the error message and status code
- **AND** the log SHALL contain a truncated version of the response body for immediate debugging

### Requirement: Application-level success condition
The HTTP handler SHALL support a `successCondition` property to evaluate the response body against a safe expression.

#### Scenario: Body evaluation success
- **WHEN** a `successCondition` expression is provided (e.g., `body.status == 'ok'`)
- **AND** the evaluation returns `true`
- **THEN** the step SHALL be marked as `success: true`

#### Scenario: Body evaluation failure
- **WHEN** a `successCondition` expression is provided
- **AND** the evaluation returns `false`
- **THEN** the step SHALL be marked as `success: false`
- **AND** the log SHALL include the response body for debugging
