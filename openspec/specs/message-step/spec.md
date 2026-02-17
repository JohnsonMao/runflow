# message-step Specification

## Purpose

TBD - created by archiving change 'add-log-message-handler'. Update Purpose after archive.

## Requirements

### Requirement: Flows MUST support steps with type `message`

A flow step MUST be allowed to have `type: 'message'` and a required `message` field (string). The engine MUST execute this step via the registered handler for `message`. Before invoking the handler, the executor SHALL apply template substitution to the step (including the `message` value). The handler SHALL return a StepResult with `success: true`, `log` set to the substituted message string, and no outputs. Parser SHALL accept any step with `id`, `type: 'message'`, and `message` as a generic step.

#### Scenario: Message with literal string

- **WHEN** a flow contains a step `{ id: 'm1', type: 'message', message: 'Starting batch run', dependsOn: [] }`
- **THEN** the executor substitutes the step (no placeholders) and invokes the message handler
- **AND** the handler returns StepResult with success: true, log: 'Starting batch run', and no outputs
- **AND** no keys are merged into context for downstream steps

#### Scenario: Message with template substitution

- **WHEN** context has `count: 3` and the message step has `message: 'Processed {{ count }} items'`
- **THEN** the executor substitutes the step so that message becomes 'Processed 3 items'
- **AND** the handler returns StepResult with log: 'Processed 3 items' and no outputs

#### Scenario: Message step has no message field or non-string message

- **WHEN** a message step has no `message` field or `message` is not a string (after substitution)
- **THEN** the handler SHALL return StepResult with success: false and an error message, or SHALL reject the step in validate()


<!-- @trace
source: add-log-message-handler
updated: 2026-02-17
code:
  - packages/handlers/src/index.ts
  - packages/handlers/src/set.ts
  - docs/flow-migration-old-to-new.md
  - packages/core/scripts/convert-old-flow-to-new.ts
  - packages/handlers/src/message.ts
tests:
  - packages/handlers/src/message.test.ts
-->

---
### Requirement: Message step SHALL NOT merge outputs into context

The message handler SHALL return a StepResult that does not add or change context keys. Downstream steps SHALL NOT see any new variables from a message step.

#### Scenario: No outputs from message step

- **WHEN** a message step runs and returns stepResult(step.id, true, { log: 'ok' })
- **THEN** the StepResult SHALL NOT include outputs, or outputs SHALL be empty
- **AND** the executor SHALL NOT merge any outputs from this step into context

<!-- @trace
source: add-log-message-handler
updated: 2026-02-17
code:
  - packages/handlers/src/index.ts
  - packages/handlers/src/set.ts
  - docs/flow-migration-old-to-new.md
  - packages/core/scripts/convert-old-flow-to-new.ts
  - packages/handlers/src/message.ts
tests:
  - packages/handlers/src/message.test.ts
-->