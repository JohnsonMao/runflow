# Loader resilience

## ADDED Requirements

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
