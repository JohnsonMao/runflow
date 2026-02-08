# condition-step Specification

## Purpose

定義 `type: condition` 的 step：根據 context 評估 `when` 運算式，結果為 true/false。Condition 可指定 `then`（一個或多個 step id）與 `else`（一個或多個 step id）；**引擎依 result 只排程 then 或只排程 else 的 step**，不將 result 寫入 context（不污染 context）。三者關係：**if** = 該 condition step（一個 id），**then** = true 時要執行的 step id(s)，**else** = false 時要執行的 step id(s)。

## Requirements

### Requirement: Condition step SHALL evaluate a when expression

A step with `type: condition` SHALL have a `when` field. The value SHALL be an expression (e.g. string evaluated against context). The executor SHALL evaluate `when` in the current step context (after template substitution). The result SHALL be a boolean. The condition step handler SHALL return a StepResult with `success: true` and SHALL set `nextSteps` to the list of step ids to schedule (from `then` when result is true, from `else` when result is false). The handler SHALL **NOT** return `outputs` so that the executor does not merge anything into the shared context; scheduling is driven solely by `nextSteps`.

#### Scenario: When evaluates to true

- **WHEN** a condition step has `when: "{{ env }} === 'prod'"` and context has `env: 'prod'`
- **THEN** the condition step's handler SHALL evaluate the expression and get true
- **AND** the StepResult SHALL have `success: true` and `nextSteps` set to the then-branch step id(s); the handler SHALL NOT return outputs
- **AND** the executor SHALL use `nextSteps` for scheduling and SHALL NOT merge any condition step data into context for subsequent steps

#### Scenario: When evaluates to false

- **WHEN** a condition step has `when: "{{ count }} > 0"` and context has `count: 0`
- **THEN** the condition step's handler SHALL evaluate to false
- **AND** the StepResult SHALL have `success: true` and `nextSteps` set to the else-branch step id(s); the handler SHALL NOT return outputs
- **AND** the executor SHALL NOT merge any condition step data into context

#### Scenario: Condition step receives substituted step

- **WHEN** the condition step has `when: "{{ flag }}"` and context has `flag: true`
- **THEN** the executor SHALL apply template substitution to the step before invoking the condition handler
- **AND** the handler SHALL receive the step with `when` already substituted if applicable (or the engine SHALL evaluate using context)

### Requirement: then and else SHALL control which dependent steps are scheduled

A condition step MAY include `then` and/or `else` fields. Each SHALL be a step id (string) or array of step ids. After the condition step runs, the executor SHALL schedule **only** steps listed in `then` when the condition result is true, and **only** steps listed in `else` when the condition result is false. Steps in then/else MUST have this condition step in their `dependsOn` to be in the DAG; the executor uses the condition result to decide which of those dependents to schedule, so that exactly one branch (then or else) runs, without writing result into context.

#### Scenario: Then branch only runs when condition is true

- **WHEN** a condition step has `then: 'stepOnTrue'` and evaluates to true, and a step with id `stepOnTrue` has `dependsOn: [conditionStepId]`
- **THEN** the condition step completes with result true and returns nextSteps (no outputs); nothing is merged into context
- **AND** the executor SHALL schedule `stepOnTrue` (it is in then and result is true)
- **AND** the executor SHALL NOT schedule any step listed in `else` for this condition step

#### Scenario: Else branch only runs when condition is false

- **WHEN** a condition step has `else: 'stepOnFalse'` and evaluates to false, and a step with id `stepOnFalse` has `dependsOn: [conditionStepId]`
- **THEN** the condition step completes with result false and returns nextSteps (no outputs); nothing is merged into context
- **AND** the executor SHALL schedule `stepOnFalse` (it is in else and result is false)
- **AND** the executor SHALL NOT schedule any step listed in `then` for this condition step

### Requirement: Condition step SHALL be registered as built-in handler

The system SHALL provide a built-in step handler for `type: condition`. The default registry SHALL include the condition handler so that flows can use `type: condition` without custom registration. The handler SHALL implement the same StepHandler interface (run, optional validate) and SHALL return a valid StepResult.

#### Scenario: Condition step executed by default registry

- **WHEN** a flow contains a step with `type: condition` and the default registry is used
- **THEN** the executor SHALL find the condition handler in the registry and call it
- **AND** the handler SHALL evaluate `when` and return StepResult with `nextSteps` (step ids to schedule); the handler SHALL NOT return outputs, so nothing is merged into context

### Requirement: Invalid or missing when SHALL produce failure result

If a condition step has no `when` field, or the evaluation of `when` throws (e.g. syntax error or runtime error), the condition step SHALL return a StepResult with `success: false` and `error` set to a string describing the failure. The flow's overall success SHALL be false.

#### Scenario: Missing when

- **WHEN** a step has `type: condition` but no `when` field
- **THEN** the handler's validate (if present) SHALL fail or the run SHALL return StepResult with success false and an error message
- **AND** the flow SHALL be marked failed (or the step skipped with error as defined)

#### Scenario: When evaluation throws

- **WHEN** the condition step's `when` expression throws during evaluation (e.g. reference to undefined variable that is not optional)
- **THEN** the handler SHALL catch the error and return StepResult with `success: false` and `error` set
- **AND** no outputs from this step SHALL be merged into context
