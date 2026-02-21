# Delta: config-openapi

## MODIFIED Requirements

### Requirement: No top-level openapi block; OpenAPI flows from handlers only

The runflow config SHALL NOT support a top-level **openapi** object. OpenAPI-derived flow resolution and discover SHALL use only **config.handlers** entries that are objects with **specPaths** (see config-handlers-openapi spec). FlowId format for OpenAPI flows SHALL be **`${handlerKey}-${operationKey}`** where handlerKey is the key in handlers whose value is an OpenApiHandlerEntry.

#### Scenario: Config without openapi block (unchanged behavior)

- **WHEN** config is loaded and has no `openapi` property
- **THEN** CLI and MCP SHALL resolve only file-type flowIds and OpenAPI flowIds from handlers (prefix-operation from config.handlers OpenAPI entries only)

#### Scenario: OpenAPI flows only from handlers

- **WHEN** config has no top-level `openapi` and has one or more handlers whose value is an object with `specPaths`
- **THEN** flowIds of the form `handlerKey-operationKey` SHALL be resolved from that handler entry (specPaths merged, then options)
- **AND** the same config SHALL be usable by both CLI and MCP

#### Scenario: specPaths and options only in handlers

- **WHEN** config has `handlers.myApi` as an OpenAPI entry with `specPaths` (array of strings) and optional `baseUrl`, `operationFilter`, `paramExpose`, `handler`
- **THEN** flowIds starting with `myApi-` SHALL be resolved using that entry's specPaths (loaded, merged into one OpenAPI document) and options
- **AND** the generated flow SHALL use stepType `myApi` and the entry's options when calling openApiToFlows on the merged spec
