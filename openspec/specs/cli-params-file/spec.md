# cli-params-file Specification

## Purpose

定義 CLI 從 JSON 檔讀入參數：`flow run <file>` 支援 `--params-file <path>`（或 `-f`），從指定路徑讀取單一 JSON 物件，與 `--param key=value` 合併後傳入 core。合併順序為先載入 params-file，再套用 --param（後者覆蓋前者同 key），以支援複雜物件與陣列。

## Requirements

### Requirement: CLI SHALL support --params-file

The `flow run <file>` command MUST accept an optional `--params-file <path>` (or short `-f <path>`). The file at `<path>` MUST be valid JSON representing a single object. The content of that object SHALL be used as (or merged into) the initial params before applying any `--param` options.

#### Scenario: Params from file only

- **WHEN** the user runs `flow run flow.yaml --params-file params.json` and `params.json` contains `{ "a": 1, "config": { "debug": true } }`
- **THEN** the CLI passes `params: { a: 1, config: { debug: true } }` to `run(flow, { params })`
- **AND** the flow runs with that initial context (subject to flow params schema validation when present)

#### Scenario: Params file plus --param override

- **WHEN** the user runs `flow run flow.yaml --params-file params.json --param a=99` and params.json has `{ "a": 1, "b": 2 }`
- **THEN** the CLI first loads the file, then applies --param; the result passed to run is `params: { a: '99', b: 2 }` (a overwritten by --param)
- **AND** duplicate keys are resolved by later-overwrites-earlier (--param overwrites file)

### Requirement: Merge order SHALL be params-file first, then --param

When both `--params-file` and one or more `--param` are present, the CLI SHALL merge in this order: (1) load the JSON object from the params file (or start with `{}` if no file); (2) apply each `--param key=value`, with later --param overwriting earlier for the same key. The final object SHALL be passed as `options.params` to `run(flow, options)`.

#### Scenario: File then param

- **WHEN** `flow run flow.yaml -f p.json --param x=1`
- **THEN** the effective params are the union of the file content and `{ x: '1' }`, with `x` from --param taking precedence if present in both

### Requirement: Invalid params-file SHALL fail before run

If the path given to `--params-file` does not exist, is not readable, or does not contain valid JSON (or does not parse to an object), the CLI SHALL exit with an error and SHALL NOT call `run()`. The error message SHOULD indicate the reason (file not found, invalid JSON, or not an object).

#### Scenario: File not found

- **WHEN** the user runs `flow run flow.yaml --params-file missing.json` and the file does not exist
- **THEN** the CLI exits with a non-zero code and reports an error (e.g. file not found)
- **AND** the flow is not executed
