# loader-resilience Specification

## Purpose

定義 `loadFromFile` 在檔案無法讀取（不存在、權限、I/O 錯誤）或內容非合法 YAML/flow 時回傳 `null`、不拋錯，讓呼叫端能一致處理失敗。

## Requirements

### Requirement: loadFromFile SHALL return null on file errors

`loadFromFile(filePath)` MUST NOT throw. When the file cannot be read (missing, permission, or other I/O error), or when the file content is not valid YAML/flow, it must return `null` so callers can handle failure uniformly.

#### Scenario: File does not exist

- **WHEN** `loadFromFile('/nonexistent/path.yaml')` is called
- **THEN** the function returns `null`
- **AND** no exception is thrown

#### Scenario: File exists and is valid flow YAML

- **WHEN** `loadFromFile(path)` is called with a path to a valid flow YAML file
- **THEN** the function returns a `FlowDefinition` object
- **AND** the object has `name` and `steps` consistent with the file content

#### Scenario: File exists but content is invalid YAML or invalid flow

- **WHEN** `loadFromFile(path)` is called with a path to a file whose content is not valid flow (e.g. invalid YAML or missing required fields)
- **THEN** the function returns `null`
- **AND** no exception is thrown
