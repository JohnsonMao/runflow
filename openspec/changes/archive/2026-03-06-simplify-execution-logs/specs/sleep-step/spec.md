## MODIFIED Requirements

### Requirement: Execution logging
The sleep handler SHALL NOT provide a default log entry when completing successfully to reduce execution noise.

#### Scenario: Silent sleep
- **WHEN** a sleep step completes successfully
- **THEN** the step result SHALL contain an empty log property
