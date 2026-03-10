## MODIFIED Requirements

### Requirement: The system SHALL provide a convention-to-flow adapter interface

The system SHALL expose an adapter interface (or package) that accepts a convention document (e.g. OpenAPI YAML path or parsed object) and SHALL produce one or more Runflow flow objects (or equivalent YAML-serializable structure) that conform to the existing flow schema. Each produced flow SHALL be executable by the existing executor and loader. The adapter SHALL NOT modify the convention source; conversion SHALL be read-only from the source.

#### Scenario: OpenAPI document yields one flow per path+method

- **WHEN** the adapter is given an OpenAPI 3.x document with paths `/users` (GET) and `/users` (POST)
- **THEN** the adapter SHALL produce at least two flows (or flow definitions), each representing one operation
- **AND** each produced flow SHALL contain steps that, when executed, perform the corresponding HTTP request (e.g. via existing http step type) with url, method, and optional headers/body derived from the OpenAPI operation

#### Scenario: Produced flow is valid Runflow YAML

- **WHEN** the adapter produces a flow object
- **THEN** the flow SHALL have `name` and `steps` (array) compatible with the existing parser
- **AND** each step SHALL have `id` and `type` and SHALL be executable by the registered handler for that type (e.g. `http`, `js`)

#### Scenario: Adapter is invokable from CLI or programmatic API

- **WHEN** a caller (CLI, MCP, or script) invokes the convention-to-flow adapter with a source path or URL and optional options
- **THEN** the adapter SHALL return the generated flow(s) (in memory or written to a path) without requiring manual YAML editing
- **AND** the caller SHALL be able to pass options such as base URL, output directory, or naming convention for generated flows

#### Scenario: Adapter SHALL support in-memory-only output

- **WHEN** the caller requests in-memory-only output (e.g. option `output: 'memory'` or no `outputDir` and a flag), and the convention document has many operations (e.g. dozens or hundreds of APIs)
- **THEN** the adapter SHALL produce and return all generated flow(s) as in-memory object(s) only and SHALL NOT write to the filesystem
- **AND** the caller SHALL be able to run a single flow by id/path+method or stream/iterate over flows without persisting them
- **AND** this mode SHALL be the default or explicitly selectable so that large API sets do not require writing many files

#### Scenario: Operation keys SHALL be normalized

- **WHEN** the adapter generates an operation key from an OpenAPI path and method (e.g., via `toOperationKey` function)
- **THEN** the operation key SHALL be normalized according to the flow-id-normalization specification
- **AND** URL-encoded characters in the path SHALL be decoded and normalized to underscores (e.g., `tt%2Fpost-users` → `tt_post-users`)
- **AND** the normalized operation key SHALL be used as the key in the returned flow map and for identifying the operation
