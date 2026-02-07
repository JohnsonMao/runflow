# command-step Specification

## Purpose

定義 flow 支援步驟型別 `command`：以字串 `run` 承載 shell 指令，由引擎在子 process 執行，產出 `StepResult`（success/stdout/stderr）。在此 change 下，command 與 js、http 同為經由 Registry 註冊的內建 handler 實作。

## ADDED Requirements

### Requirement: Flows MUST support steps with type `command` running shell commands

A flow step MUST be allowed to have `type: 'command'` and a `run` string containing the shell command. The engine MUST execute this step via the **registered handler for `command`** (from the default or provided registry). The handler MUST run the command in a child process and produce a `StepResult` with success/failure, stdout, and stderr. Parser SHALL accept any step with `id` and `type: 'command'` as a generic step (id + type + remaining keys); validation of `run` is the responsibility of the command handler—parser SHALL NOT return null solely because `run` is missing for type `command` (invalid steps may be rejected at run time by the handler).

#### Scenario: Valid command step runs successfully

- **WHEN** a flow contains a step `{ id: 's1', type: 'command', run: 'echo hello' }` and the default (or provided) registry includes the command handler
- **THEN** the executor invokes the command handler with the step and context
- **AND** the handler runs the command and returns a StepResult with `success: true`, and stdout/stderr as captured from the child process

#### Scenario: Command step exits with non-zero

- **WHEN** a flow contains a command step whose run exits with non-zero (e.g. `run: 'exit 1'`)
- **THEN** the handler marks the step as failed
- **AND** the step's `StepResult` has `success: false` and typically `stderr` or exit code information

#### Scenario: Parser accepts steps with type command as generic step

- **WHEN** YAML contains a step with `type: command` and optional `run` field
- **THEN** the parser SHALL include a generic FlowStep (id, type, and remaining keys) in the flow steps
- **AND** type-specific validation (e.g. run required) is NOT required at parse time; the built-in command handler SHALL enforce input contract at run time and MAY produce an error StepResult for invalid step shape

#### Scenario: Flow can mix command, js, and http steps

- **WHEN** a flow has steps of type `command`, `js`, and `http`
- **THEN** the executor runs each step in order via the registry
- **AND** the run result contains one StepResult per step in the same order

### Requirement: Command step run SHALL support template substitution

Before the command handler is invoked, the executor SHALL substitute placeholders in the step's `run` string using the current context (per custom-node-registry: substitution is applied by executor before calling handler). The handler SHALL receive the step with `run` already substituted.

#### Scenario: Run string substituted from context

- **WHEN** context has `who: 'world'` and the command step has `run: "echo Hello {{ who }}"`
- **THEN** the executor passes the step to the handler with `run` already substituted (e.g. `"echo Hello world"`)
- **AND** the handler executes that string as the shell command
