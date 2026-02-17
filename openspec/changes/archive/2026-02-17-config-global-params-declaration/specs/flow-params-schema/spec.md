# flow-params-schema Specification (delta)

## MODIFIED Requirements

### Requirement: run() SHALL validate params against flow params declaration when present

When the caller provides **effectiveParamsDeclaration** in RunOptions, run(flow, options) SHALL validate options.params against that effective declaration instead of flow.params. The effective declaration is the merge of config global params and flow params with flow overriding config for the same param name (see config-params-declaration spec). When effectiveParamsDeclaration is absent, run() SHALL validate against flow.params only (unchanged behavior). Validation MUST check: required params present, types match, values in enum when enum is declared, object/array shape when schema/items are declared. Default application SHALL use the effective declaration (or flow.params when effectiveParamsDeclaration is absent). On failure, run SHALL fail with an error that identifies missing required, type mismatch, or enum violation.

#### Scenario: Validation passes

- **WHEN** the flow declares `params: [{ name: 'a', type: 'string', required: true }]` and `run(flow, { params: { a: 'x' } })` is called
- **THEN** validation succeeds and execution proceeds

#### Scenario: Missing required param

- **WHEN** the flow declares a required param and `options.params` omits it
- **THEN** validation fails before any step runs
- **AND** the error message indicates the missing required param(s)

#### Scenario: Type mismatch

- **WHEN** the flow declares `type: number` for a param and the provided value is a string that is not a valid number (or is an object)
- **THEN** validation fails
- **AND** the error message indicates type mismatch for that param

#### Scenario: Enum violation

- **WHEN** the flow declares `enum: [dev, prod]` and the provided value is not in that list
- **THEN** validation fails
- **AND** the error message indicates the value is not in the allowed set

#### Scenario: Validation uses effective declaration when provided

- **WHEN** the caller invokes run(flow, { params: { env: "production" }, effectiveParamsDeclaration: [{ name: "env", type: "string", default: "development" }] }) and the flow has no params or different params
- **THEN** run() SHALL validate options.params against effectiveParamsDeclaration
- **AND** default application SHALL use effectiveParamsDeclaration (e.g. missing keys get default from declaration)
- **AND** execution SHALL proceed with initial context built from validated params and declaration defaults

#### Scenario: Effective declaration absent preserves current behavior

- **WHEN** the caller invokes run(flow, { params: { a: "x" } }) without effectiveParamsDeclaration
- **THEN** run() SHALL validate options.params against flow.params only
- **AND** behavior SHALL be unchanged from before this change
