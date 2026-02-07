# exec-params Specification

## Purpose

定義執行時傳參：CLI 可透過 `--param key=value` 傳入參數，core `run(flow, options)` 接受 `options.params`，並以之作為流程的初始 context。

## Requirements

### Requirement: run() SHALL accept optional params

`run(flow, options)` MUST accept `options.params` as an optional `Record<string, string>`. When provided, it forms the initial context for the flow. When omitted, the initial context is empty (equivalent to `{}`).

#### Scenario: run with params

- **WHEN** `run(flow, { params: { a: '1', b: '2' } })` is called
- **THEN** the executor uses `{ a: '1', b: '2' }` as the initial context for the first step
- **AND** no error is thrown

#### Scenario: run without params

- **WHEN** `run(flow, {})` or `run(flow)` is called
- **THEN** the initial context is empty (no params)
- **AND** execution proceeds as before (steps that do not depend on params are unaffected)

### Requirement: CLI SHALL support --param key=value

The `flow run <file>` command MUST accept one or more `--param key=value` options. The first `=` separates key from value; value may be empty. Multiple `--param` options are merged; duplicate keys are resolved by later-overwrites-earlier.

#### Scenario: Single param

- **WHEN** the user runs `flow run flow.yaml --param a=1`
- **THEN** the CLI passes `params: { a: '1' }` to `run(flow, { params })`
- **AND** the flow runs with that initial context

#### Scenario: Multiple params

- **WHEN** the user runs `flow run flow.yaml --param a=1 --param b=2`
- **THEN** the CLI passes `params: { a: '1', b: '2' }` to `run(flow, { params })`

#### Scenario: Duplicate key (later overwrites)

- **WHEN** the user runs `flow run flow.yaml --param x=1 --param x=2`
- **THEN** the CLI passes `params: { x: '2' }` to `run(flow, { params })`

#### Scenario: Empty value

- **WHEN** the user runs `flow run flow.yaml --param k=`
- **THEN** the CLI passes `params: { k: '' }` (or equivalent) to `run(flow, { params })`
