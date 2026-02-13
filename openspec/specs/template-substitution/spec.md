# template-substitution Specification

## Purpose

定義步驟字串的模板替換：在適用欄位（至少 command 步驟的 `run`）中，支援 `{{ key }}`、dot 語法（`{{ key.nested }}`）、中括號語法（`{{ tags[0] }}`），從當前 context 取值；若值為物件或陣列則以 JSON.stringify 代入，否則轉字串。替換在執行該步驟前、使用當時累積的 context 執行。

## Requirements

### Requirement: Command step run SHALL support template substitution

The value of the `run` field of a step with `type: command` SHALL be processed for template substitution before being passed to the shell. Substitution SHALL use the current step context (initial params plus outputs of all previous steps). The syntax SHALL include root keys, dot notation for nested properties, and bracket notation for array indices.

#### Scenario: Root key substitution

- **WHEN** context is `{ who: 'world' }` and the command step has `run: "echo Hello {{ who }}"`
- **THEN** the string passed to the shell is `echo Hello world`
- **AND** the step runs with that command

#### Scenario: Dot notation

- **WHEN** context is `{ config: { debug: true, level: 2 } }` and run is `run: "echo {{ config.level }}"`
- **THEN** the substituted string is `echo 2`
- **AND** nested property is resolved correctly

#### Scenario: Bracket notation for array index

- **WHEN** context is `{ tags: ['a', 'b', 'c'] }` and run is `run: "echo {{ tags[0] }}"`
- **THEN** the substituted string is `echo a`
- **AND** array index 0 is resolved

#### Scenario: Mixed dot and bracket

- **WHEN** context is `{ data: { list: [10, 20] } }` and run is `run: "echo {{ data.list[1] }}"`
- **THEN** the substituted string is `echo 20`
- **AND** chained property and index are resolved in order

### Requirement: Object and array values SHALL be JSON stringified

When the resolved value for a placeholder is an object or an array, the substitution SHALL use the result of `JSON.stringify(value)` (implementation-defined formatting, e.g. no extra whitespace). When the value is string, number, or boolean, it SHALL be converted to string directly.

#### Scenario: Object value

- **WHEN** context is `{ config: { a: 1, b: 2 } }` and run is `run: "echo {{ config }}"`
- **THEN** the substituted string is `echo {"a":1,"b":2}` (or equivalent JSON without unnecessary spaces)
- **AND** the command receives a single JSON string

#### Scenario: Array value

- **WHEN** context is `{ tags: ['x', 'y'] }` and run is `run: "echo {{ tags }}"`
- **THEN** the substituted string is `echo ["x","y"]` (or equivalent)
- **AND** the command receives a JSON array string

### Requirement: Undefined or null SHALL resolve to empty string

When resolving a path (e.g. `{{ key.nested }}` or `{{ items[5] }}`), if any intermediate step yields `undefined` or `null`, the substitution result for that placeholder SHALL be the empty string `""`.

#### Scenario: Missing key

- **WHEN** context is `{ a: 1 }` and run is `run: "echo {{ b }}"`
- **THEN** the substituted string is `echo ` (empty where {{ b }} was)
- **AND** no error is thrown; substitution completes

#### Scenario: Null in path

- **WHEN** context is `{ obj: null }` and run is `run: "echo {{ obj.foo }}"`
- **THEN** the substituted string is `echo ` (empty)
- **AND** accessing property of null yields empty string

### Requirement: Substitution SHALL use current context at step execution time

Substitution for a step SHALL be performed immediately before executing that step, using the context as it exists at that time. Context SHALL have initial params at top level and previous step outputs namespaced by step id (see step-context). The same context SHALL be used for both substitution and (where applicable) step execution.

#### Scenario: Context from prior step (namespaced by step id)

- **WHEN** step 1 with `id: 'step1'` (e.g. js) returned `outputs: { version: '1.0' }` and step 2 is command with `run: "echo {{ step1.version }}"`
- **THEN** step 2's run is substituted with context including `step1.version === '1.0'`
- **AND** the command sees `echo 1.0`
