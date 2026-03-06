## MODIFIED Requirements

### Requirement: Step display in run summary
The CLI SHALL display a summary of steps after a flow execution.

#### Scenario: Filtered summary
- **WHEN** the flow execution finishes
- **THEN** the system SHALL ONLY display steps that are either unsuccessful (failed) OR contain a non-empty log
- **AND** successful steps with empty logs SHALL be hidden from the summary

#### Scenario: No iteration markers
- **WHEN** displaying steps from a loop iteration
- **THEN** the system SHALL NOT display standalone iteration header lines (e.g., `loop [iteration 1]`)
- **AND** the step ID itself SHALL be used to distinguish iterations (e.g., `loop.iteration_1.step`)
