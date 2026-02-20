# config-openapi Specification (delta)

本 delta：移除頂層 `openapi` 區塊；OpenAPI 流程改由 `config.handlers` 內之 OpenAPI 型別 entry 提供，flowId 仍為 `key-operationKey`。

## REMOVED Requirements

### Requirement: Config MAY define an openapi block (prefix-keyed)

The runflow config SHALL NOT support a top-level **openapi** object. OpenAPI-derived flow resolution and discover SHALL use only **config.handlers** entries that are objects with **specPath** (see config-handlers-openapi spec).

**Reason:** OpenAPI and handlers are unified under a single `handlers` surface; the handler key is the prefix and step type, so a separate openapi block is redundant and removed.

**Migration:** Move each `openapi[prefix]` entry into `handlers[prefix]` with the same `specPath`, `baseUrl`, `operationFilter`, and `paramExpose`. Use `handler` in place of `override` (the path or name of the custom .mjs). Omit `overrideStepType`; the handler key is the step type. FlowId format remains `prefix-operationKey` (now `key-operationKey` where key is the handler key).

#### Scenario: Config without openapi block (unchanged behavior)

- **WHEN** config is loaded and has no `openapi` property
- **THEN** CLI and MCP SHALL resolve only file-type flowIds and OpenAPI flowIds from handlers (prefix-operation from config.handlers OpenAPI entries only)

#### Scenario: OpenAPI flows only from handlers

- **WHEN** config has no top-level `openapi` and has one or more handlers whose value is an object with `specPath`
- **THEN** flowIds of the form `handlerKey:operationKey` SHALL be resolved from that handler entry (specPath, options)
- **AND** the same config SHALL be usable by both CLI and MCP

### Requirement: openapi per-prefix specPath and options

The runflow config SHALL NOT support per-prefix options under a top-level `openapi` object. Per-spec options (specPath, baseUrl, operationFilter, paramExpose, and optional execution module) SHALL be defined only as **handlers** entries of type OpenApiHandlerEntry (see config-handlers-openapi).

**Reason:** Single source of truth for both step handlers and OpenAPI specs is config.handlers.

**Migration:** For each former `openapi[prefix]` value, set `handlers[prefix]` to an object with the same `specPath`, `baseUrl`, `operationFilter`, `paramExpose`. If the old entry had `override`, set `handler` to that value (path or handler name). Do not set `overrideStepType`.

#### Scenario: specPath and options only in handlers

- **WHEN** config has `handlers.myApi` as an OpenAPI entry with `specPath` and optional `baseUrl`, `operationFilter`, `paramExpose`, `handler`
- **THEN** flowIds starting with `myApi-` SHALL be resolved using that entry's specPath and options
- **AND** the generated flow SHALL use stepType `myApi` and the entry's options when calling openApiToFlows
