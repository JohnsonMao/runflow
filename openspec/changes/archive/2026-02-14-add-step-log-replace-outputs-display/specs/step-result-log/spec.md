# step-result-log (Delta)

## Purpose

StepResult 具備可選的 **log** 欄位，供 MCP execute 與 CLI --verbose 顯示每步的簡短摘要；自 StepResult 移除 **stdout**、**stderr**，統一以 log 作為對外顯示來源。

## ADDED Requirements

### Requirement: StepResult SHALL have optional log and SHALL NOT have stdout/stderr

- StepResult SHALL include an optional `log?: string` field. Handlers MAY set it via `context.stepResult(stepId, success, { log: '...' })` to provide a one-line summary for display.
- StepResult SHALL NOT include `stdout` or `stderr` fields. Display of step output SHALL use `log` when present.

#### Scenario: Step with log

- **WHEN** a handler returns `stepResult(step.id, true, { log: 'GET https://example.com → 200' })`
- **THEN** the StepResult has `log` set to that string
- **AND** MCP formatRunResult and CLI --verbose SHALL show that string as the step's display line (e.g. `log: GET https://example.com → 200`)

#### Scenario: Step without log

- **WHEN** a handler returns stepResult without `log`
- **THEN** the StepResult may omit `log` or have it undefined
- **AND** display SHALL show only the step id and success badge (e.g. `- ✓ stepId`); no stdout/stderr/outputs in the display.

### Requirement: StepResultOptions SHALL support log and SHALL NOT support stdout/stderr

- StepResultOptions SHALL include optional `log?: string` and SHALL NOT include `stdout` or `stderr`.
- The `stepResult(stepId, success, opts)` factory SHALL set `out.log = opts.log` when provided, and SHALL NOT set any stdout or stderr on the result.

#### Scenario: stepResult factory sets log when provided

- **WHEN** caller invokes `stepResult('s1', true, { log: 'done' })`
- **THEN** the returned StepResult has `log: 'done'` and SHALL NOT have `stdout` or `stderr` properties
- **AND** the result is valid for executor and MCP/CLI display

### Requirement: MCP execute tool result SHALL display step log only

- When formatting RunResult for the execute tool, the formatter SHALL output per step: success badge, step id, and if present `error` and `log`. It SHALL NOT output stdout, stderr, or the full `outputs` object.

#### Scenario: formatRunResult outputs log and not outputs

- **WHEN** RunResult has a step with `stepId: 'req', success: true, log: 'GET /api → 200'` and no error
- **THEN** the formatted text for that step SHALL include `log: GET /api → 200`
- **AND** the formatted text SHALL NOT include `outputs:` or stdout/stderr for that step

### Requirement: CLI --verbose SHALL output step.log

- When the CLI runs with `--verbose`, it SHALL write each step's `log` (if present) to process.stdout. It SHALL NOT read or write step.stdout or step.stderr.

#### Scenario: CLI verbose writes log to stdout

- **WHEN** the CLI runs a flow with `--verbose` and a step returns `log: 'slept 1s'`
- **THEN** the CLI SHALL write that string (e.g. with newline) to process.stdout for that step
- **AND** the CLI SHALL NOT read or write any step.stdout or step.stderr
