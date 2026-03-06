# execution-snapshot-inspect Specification

## ADDED Requirements

### Requirement: Execution SHALL save results to snapshot
Upon completion of a flow run, the engine SHALL save the full execution results (including all inputs and outputs of every step) to a JSON file. The file location SHALL be `.runflow/runs/latest.json`. This ensures that even truncated results from logs are accessible in full for subsequent analysis.

#### Scenario: Snapshot file creation
- **WHEN** a flow run completes
- **THEN** a file at `.runflow/runs/latest.json` SHALL be created or updated
- **AND** it SHALL contain a complete representation of the RunResult

### Requirement: CLI SHALL provide inspect command
The CLI SHALL provide an `inspect` command that allows users to query the latest execution snapshot. This command SHALL accept a path expression (using the enhanced template substitution syntax) to retrieve specific fields from the snapshot.

#### Scenario: Inspecting specific step output
- **WHEN** a user runs `runflow inspect --path "step1.body.id"`
- **THEN** the CLI SHALL read `.runflow/runs/latest.json`
- **AND** output the value of the `id` field from `step1`'s output body

### Requirement: MCP SHALL provide inspect tool
The MCP server SHALL expose an `inspect` tool that allows an AI agent to query the latest execution snapshot. This tool SHALL use the same expression-based querying as the CLI command.

#### Scenario: AI queries snapshot via MCP
- **WHEN** an AI calls the `inspect` tool with path `"users.map(id)"`
- **THEN** the tool SHALL return the list of IDs from the `users` step output in the latest snapshot
- **AND** this SHALL NOT re-execute any flow steps
