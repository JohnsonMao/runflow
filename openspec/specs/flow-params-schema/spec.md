# flow-params-schema Specification

## Purpose

定義 flow 頂層參數宣告：YAML 可宣告參數名稱、型別、必填、預設、enum、物件形狀（schema）與陣列元素型別（items）。執行前依此宣告驗證傳入的 params（實作建議以 Zod 產生 schema）；驗證失敗則回傳明確錯誤（缺必填、型別錯誤、不在 enum 內）。

## Requirements

### Requirement: Flow MAY declare top-level params array; when present parser SHALL include it

A flow definition MAY include an optional top-level `params` array. When present, the parser SHALL include the params declaration in the parsed flow. Each element SHALL declare one parameter with: `name` (string), `type` (string: `string` | `number` | `boolean` | `object` | `array`), optional `required` (boolean, default false), optional `default`, optional `enum` (array of allowed values), optional `description` (string).

#### Scenario: Flow with params declaration

- **WHEN** a flow YAML contains a top-level `params` array with at least one item (e.g. `name: who`, `type: string`, `required: true`)
- **THEN** the parser includes the params declaration in the parsed flow
- **AND** the flow can be validated at run time against provided params

#### Scenario: Flow without params

- **WHEN** a flow YAML omits the `params` key
- **THEN** the flow has no params schema
- **AND** run-time validation does not require any specific params (existing behaviour preserved)

### Requirement: Object params MAY declare schema (shape)

When a param has `type: object`, it MAY include a `schema` (or `properties`) field describing nested shape. Each property uses the same type semantics (type, required, default, enum); nesting MAY be recursive. The implementation SHALL validate the runtime value against this shape (e.g. via Zod).

#### Scenario: Object param with schema

- **WHEN** a param is declared with `type: object` and `schema: { debug: { type: boolean, default: false }, level: { type: number, required: true } }`
- **THEN** at run time, provided params for this key are validated: `debug` optional boolean, `level` required number
- **AND** if validation fails (e.g. missing `level` or wrong type), run fails with a clear error

### Requirement: Array params MAY declare items type

When a param has `type: array`, it MAY include an `items` field describing element type (e.g. `items: { type: string }`). The implementation SHALL validate that array elements match the declared type.

#### Scenario: Array param with items

- **WHEN** a param is declared with `type: array` and `items: { type: string }`
- **THEN** at run time, the value for this key must be an array of strings
- **AND** if an element is not a string, validation fails

### Requirement: run() SHALL validate params against flow params declaration when present

When the flow has a `params` declaration, `run(flow, options)` SHALL validate `options.params` against that declaration before executing steps. Validation MUST check: required params present, types match, values in enum when enum is declared, object/array shape when schema/items are declared. On failure, run SHALL fail with an error that identifies missing required, type mismatch, or enum violation.

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

### Requirement: RunOptions.params SHALL accept nested values

`run(flow, options)` SHALL accept `options.params` as `Record<string, unknown>` (or equivalent) so that nested objects and arrays can be passed. This supersedes the previous exec-params constraint of `Record<string, string>` when flow params declaration is used; backward compatibility for string-only params is preserved when no params schema is declared.

#### Scenario: Params with object and array

- **WHEN** `run(flow, { params: { config: { debug: true }, tags: ['a', 'b'] } })` is called and the flow's params declaration allows object and array for those keys
- **THEN** validation uses the declared schema
- **AND** the initial context for steps contains those nested values
