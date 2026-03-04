# chainable-handler-utils Specification

## Purpose

Define the new chainable utility library injected into handler factories. This allows handlers to perform common data transformations and template substitutions in a concise, readable, and "zero-import" manner.

## ADDED Requirements

### Requirement: utils SHALL provide chainable string processing

The `utils` object SHALL provide a `str(input: string)` method that returns a chainable wrapper for string operations. This wrapper SHALL include at least: `.substitute(params: Record<string, unknown>)` for template replacement and `.lowercase()` for case transformation. It SHALL have a `.value()` method to retrieve the final string.

#### Scenario: Chainable string substitution and transformation
- **WHEN** a handler calls `utils.str('{{ base }}/API').substitute({ base: 'HTTP' }).lowercase().value()`
- **THEN** the result SHALL be `"http/api"`
- **AND** the handler SHALL NOT require manual `substitute` calls from `@runflow/core`

### Requirement: utils SHALL provide chainable data manipulation

The `utils` object SHALL provide a `data(input: any)` method that returns a chainable wrapper for data object manipulation. This wrapper SHALL include at least: `.pick(keys: string[])` for picking properties and `.merge(other: object)` for merging objects. It SHALL have a `.toJSON()` method to return a JSON string and a `.value()` method for the final object.

#### Scenario: Chainable data picking and merging
- **WHEN** a handler calls `utils.data({ a: 1, b: 2 }).pick(['a']).merge({ c: 3 }).value()`
- **THEN** the result SHALL be `{ a: 1, c: 3 }`
- **AND** the original object SHALL NOT be modified

### Requirement: utils SHALL provide optional chainable HTTP client

The `utils` object SHALL provide a simplified, chainable HTTP client (e.g., `utils.http.get(url).json().send()`). This client SHALL automatically integrate with the injected `AbortSignal` if provided by the engine.

#### Scenario: Chainable HTTP request
- **WHEN** a handler calls `await utils.http.post(url).json({ id: 1 }).send()`
- **THEN** it SHALL perform a POST request with the given JSON body
- **AND** the request SHALL be automatically aborted on step timeout via the injected `signal`

### Requirement: Chainable utils SHALL be discoverable via IDE autocomplete

The `utils` object and its chainable methods SHALL be defined such that IDEs (e.g., VS Code) can provide full IntelliSense when used within the injected factory function. This MUST be achieved via ambient type declarations (e.g., `.d.ts` files) without requiring the user to `import` types explicitly.

#### Scenario: Developer receives autocomplete for chainable utils
- **WHEN** a developer types `utils.str('...').`
- **THEN** the IDE SHALL suggest `substitute`, `lowercase`, `value`, etc.
- **AND** no `import` or `/// <reference />` SHALL be required if the workspace is correctly configured
