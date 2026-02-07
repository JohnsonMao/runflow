# CLI file validation

## ADDED Requirements

### Requirement: flow run SHALL validate file path before loading

The `flow run <file>` command MUST check that `<file>` exists and is a regular file before calling `loadFromFile`. If the path does not exist or is not a file, the CLI must print a clear error and exit with code 1.

#### Scenario: File path does not exist

- **WHEN** the user runs `flow run /nonexistent/file.yaml`
- **THEN** the CLI prints an error message indicating the file was not found (or does not exist)
- **AND** the process exits with code 1
- **AND** `loadFromFile` is not called for that path (optional implementation detail; main requirement is user-visible behavior)

#### Scenario: Path exists and is a file

- **WHEN** the user runs `flow run path/to/valid-flow.yaml` and the path exists and is a file
- **THEN** the CLI proceeds to load and run the flow (or fail with flow validation error if content is invalid)
- **AND** behavior is unchanged from current valid-file case
