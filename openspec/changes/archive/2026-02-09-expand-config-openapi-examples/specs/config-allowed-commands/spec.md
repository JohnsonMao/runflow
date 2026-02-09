# Spec: config-allowed-commands

## ADDED Requirements

### Requirement: Config MAY define allowedCommands array

The runflow config (e.g. `runflow.config.mjs`) MAY export an `allowedCommands` array of strings (executable names). When present, the CLI SHALL pass it to `run(flow, { allowedCommands })`. The engine SHALL pass it to the step context so the command handler can restrict which commands are allowed.

#### Scenario: Config without allowedCommands

- **WHEN** config is loaded and has no `allowedCommands` property
- **THEN** the CLI SHALL pass undefined for allowedCommands to run()
- **AND** the command handler SHALL use the built-in default safe list (e.g. echo, exit, true, false)

#### Scenario: Config with allowedCommands empty array

- **WHEN** config has `allowedCommands: []`
- **THEN** the CLI SHALL pass an empty array to run()
- **AND** the command handler SHALL reject every command step with an error that allowedCommands is empty

#### Scenario: Config with allowedCommands non-empty

- **WHEN** config has `allowedCommands: ['node','echo']`
- **THEN** the CLI SHALL pass that array to run() (filtered to string elements only)
- **AND** the command handler SHALL allow only steps whose run string's first token (basename) is in the list; others SHALL fail with "command not allowed"
