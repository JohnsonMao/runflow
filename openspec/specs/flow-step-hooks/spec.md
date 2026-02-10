# flow-step-hooks Specification

## Purpose

定義在 **convention 轉換為 flow 時**，依 operation 在 API step 前／後插入自訂步驟的規格。不引入 step 上的 `before`／`after` 欄位；插入僅在轉換階段由 adapter 依設定產出帶有正確 `dependsOn` 的 flow。

## Requirements

### Requirement: The system SHALL NOT add before/after fields to steps

Flows and steps SHALL NOT have optional `before` or `after` fields. Hook-like behavior (running steps before or after an API step) SHALL be achieved only at **convention-to-flow conversion time** by the adapter inserting additional steps and setting `dependsOn` so that execution order is correct. The executor SHALL NOT interpret any hook-related fields; it only runs the DAG.

#### Scenario: No before/after on step schema

- **WHEN** a flow is loaded by the existing parser
- **THEN** step objects SHALL NOT be required or expected to have `before` or `after` properties
- **AND** the executor SHALL run steps solely according to `dependsOn` and DAG semantics

### Requirement: Per-operation step injection SHALL be defined as part of convention-to-flow

The ability to insert steps before and after each operation's API step SHALL be specified and implemented as part of the convention-to-flow adapter (see convention-to-flow spec). The adapter SHALL accept a hook configuration keyed by operation (e.g. path+method or operationId) and SHALL produce flows whose steps are ordered as: [before steps] → [API step] → [after steps], using only `dependsOn`. Different operations MAY have different before/after steps.

#### Scenario: Hook configuration is passed at conversion time only

- **WHEN** the caller invokes the convention-to-flow adapter with an option such as `hooks: { 'GET /users': { before: [...], after: [...] }, 'POST /users': { before: [...], after: [...] } }`
- **THEN** the adapter SHALL generate flows that already contain the inserted steps with correct dependencies
- **AND** the emitted flow(s) SHALL be plain Runflow (no before/after on any step)

#### Scenario: Different steps per operation

- **WHEN** hook config specifies different before/after step definitions for operation A and operation B
- **THEN** the generated flow for A SHALL contain only the steps configured for A (before, API, after)
- **AND** the generated flow for B SHALL contain only the steps configured for B
- **AND** step ids in generated flows SHALL be unique within each flow (adapter MAY prefix or suffix by operation to avoid clashes when reusing shared step definitions)
