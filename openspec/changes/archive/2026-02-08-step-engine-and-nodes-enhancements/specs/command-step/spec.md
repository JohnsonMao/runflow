# command-step (delta)

## Purpose

Add optional timeout, cwd, and env to command steps. Behavior when these are present is defined below.

## ADDED Requirements

### Requirement: Command step MAY declare timeout, cwd, and env

A command step MAY include optional `timeout` (number, seconds), `cwd` (string, working directory), and `env` (object, merged with process.env). When `timeout` is present and positive, the handler SHALL run the command with a time limit; if the command does not complete within that time, the handler SHALL return a StepResult with success: false and error indicating timeout. When `cwd` is present, the handler SHALL run the command in that directory (after template substitution if cwd is a string). When `env` is present, the handler SHALL merge it with process.env (environment for the child process); string values in env SHALL support template substitution before the command runs. If none of timeout, cwd, env are set, the handler SHALL behave as before (e.g. execSync, current working directory, process.env).

#### Scenario: Command with timeout completes in time

- **WHEN** a command step has `run: 'sleep 1'` and `timeout: 5`
- **THEN** the handler runs the command with a 5-second limit; the command completes within 5 seconds
- **AND** the handler returns StepResult with success: true and captured stdout/stderr

#### Scenario: Command exceeds timeout

- **WHEN** a command step has `run: 'sleep 10'` and `timeout: 1`
- **THEN** the handler runs the command with a 1-second limit; the command does not complete in time
- **AND** the handler returns StepResult with success: false and error indicating timeout

#### Scenario: Command with cwd

- **WHEN** a command step has `run: 'pwd'`, `cwd: '/tmp'`
- **THEN** the handler runs the command with working directory /tmp
- **AND** stdout (or equivalent) reflects the chosen directory

#### Scenario: Command with env

- **WHEN** a command step has `run: 'echo $MY_VAR'`, `env: { MY_VAR: 'hello' }`
- **THEN** the handler runs the command with env including MY_VAR=hello (and existing process.env)
- **AND** stdout includes the value from env

#### Scenario: Env and cwd support template substitution

- **WHEN** context has `dir: '/tmp'`, `key: 'X'` and the command step has `cwd: '{{ dir }}'`, `env: { '{{ key }}': 'value' }` (or env keys/values that use {{ }})
- **THEN** the executor substitutes the step before calling the handler; the handler receives substituted cwd and env
- **AND** the command runs with the resolved directory and environment
