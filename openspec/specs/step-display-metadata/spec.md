# step-display-metadata Specification

## Purpose

定義 FlowStep 的選用顯示/文件欄位 `name` 與 `description` 的語意與用途。兩者僅供顯示與文件化，不影響 context、DAG、執行或 engine-reserved 行為。

## Requirements

### Requirement: FlowStep MAY declare optional name (display only)

A step in the flow definition MAY include an optional field `name` (string). The field SHALL be used only for display and documentation (e.g. node labels, lists, logs). The engine SHALL NOT use `name` for execution, context keying, or DAG resolution. When absent, consumers SHALL use the step's `id` (or a fallback such as "id (type)") for display.

#### Scenario: Step with name

- **WHEN** a step has `id: 'fetch'` and `name: 'Fetch user profile'`
- **THEN** consumers MAY display "Fetch user profile" as the step label
- **AND** the engine SHALL treat the step identically to a step without `name` (same context key, DAG, execution)

#### Scenario: Step without name

- **WHEN** a step has `id: 'fetch'` and no `name`
- **THEN** consumers SHALL use a fallback for display (e.g. "fetch" or "fetch (http)")
- **AND** execution and context behavior SHALL be unchanged

### Requirement: FlowStep MAY declare optional description (display only)

A step in the flow definition MAY include an optional field `description` (string). The field SHALL be used only for display and documentation (e.g. tooltips, detail views, discover output). The engine SHALL NOT use `description` for execution. The string MAY be multi-line; consumers MAY interpret it as plain text or Markdown at their discretion.

#### Scenario: Step with description

- **WHEN** a step has `description: 'Calls the user API and returns profile data.'`
- **THEN** consumers MAY show this text in tooltips or detail views
- **AND** the engine SHALL ignore the field for execution and context

#### Scenario: Step without description

- **WHEN** a step has no `description`
- **THEN** consumers SHALL NOT assume any step-level description for display
- **AND** execution SHALL be unchanged

### Requirement: Loader SHALL preserve name and description when present

When loading a flow (YAML or equivalent), the loader SHALL preserve `name` and `description` on each step when present. The loader SHALL NOT reject or strip these fields. Validation SHALL NOT require `name` or `description` to be present or to match a specific format beyond being strings when provided.

#### Scenario: Loaded flow retains step name and description

- **WHEN** a flow YAML contains a step with `name` and `description`
- **THEN** the loaded FlowDefinition SHALL have those properties on the corresponding FlowStep
- **AND** the flow SHALL be valid for execution without any engine use of those fields
