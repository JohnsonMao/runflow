# dag-execution Specification

## Purpose

定義以 DAG（有向無環圖）為模型的 flow 執行：每個 step 可聲明 `dependsOn` 指定依賴的 step id，引擎依賴關係拓撲排序後執行；無 `dependsOn` 的 step 視為孤節點，不納入執行圖、不執行。支援無依賴或依賴已滿足的 steps 並行執行。

## Requirements

### Requirement: FlowStep MAY declare dependsOn

A step in the flow definition MAY include an optional `dependsOn` field. `dependsOn` SHALL be an array of step ids (strings) that this step depends on. The executor SHALL use this to build the execution graph; steps without `dependsOn` SHALL NOT be executed (orphan nodes).

#### Scenario: Step with dependsOn is scheduled

- **WHEN** a step has `dependsOn: ['stepA', 'stepB']` and stepA and stepB have completed
- **THEN** the executor SHALL schedule and run this step (subject to DAG order)
- **AND** the step receives context that includes outputs from stepA and stepB

#### Scenario: Step without dependsOn field is orphan

- **WHEN** a step has no `dependsOn` field (property absent)
- **THEN** the executor SHALL NOT include that step in the execution graph
- **AND** that step SHALL NOT be executed
- **AND** no StepResult SHALL be produced for that step (or a defined "skipped/orphan" result per implementation)

#### Scenario: Step with dependsOn empty array is root

- **WHEN** a step has `dependsOn: []` (explicit empty array)
- **THEN** the executor SHALL include that step in the graph as a root (no incoming edges)
- **AND** that step SHALL be eligible to run in the first wave

#### Scenario: dependsOn references non-existent step id

- **WHEN** a step has `dependsOn: ['missingId']` and no step with id `missingId` exists in the flow
- **THEN** the executor SHALL treat this as an error (invalid flow or validation failure) as defined by implementation
- **AND** the flow run SHALL fail or report the error

### Requirement: Executor SHALL execute steps in DAG order

The executor SHALL build a directed acyclic graph from steps that have `dependsOn`. It SHALL compute a valid execution order (topological sort) such that a step runs only after all of its dependencies have completed. Steps with no remaining unsatisfied dependencies MAY be executed in parallel.

#### Scenario: Topological order is respected

- **WHEN** step B has `dependsOn: ['A']` and step C has `dependsOn: ['A']`
- **THEN** step A SHALL run first
- **AND** steps B and C SHALL run only after A has completed
- **AND** B and C MAY run in parallel with each other

#### Scenario: Linear chain

- **WHEN** step A has no dependsOn (or is root), step B has `dependsOn: ['A']`, step C has `dependsOn: ['B']`
- **THEN** execution order SHALL be A, then B, then C
- **AND** context for B includes A's outputs; context for C includes A's and B's outputs

### Requirement: Cycle in dependsOn SHALL be invalid

If the graph formed by `dependsOn` contains a cycle, the flow SHALL be invalid. The executor (or parser/validator) SHALL detect cycles and SHALL NOT run the flow; it SHALL return or report an error.

#### Scenario: Cycle detected

- **WHEN** step A has `dependsOn: ['C']`, step B has `dependsOn: ['A']`, step C has `dependsOn: ['B']`
- **THEN** the system SHALL detect the cycle and SHALL NOT execute the flow
- **AND** an error SHALL be returned to the caller (e.g. invalid flow or cycle detected)

### Requirement: Context SHALL accumulate across executed steps in DAG order

Context (params and step outputs) SHALL be merged in the order steps complete. A step SHALL receive context that includes initial params and outputs from all dependency steps that have already completed. Outputs from a step SHALL be merged into context for any step that depends on it.

#### Scenario: Parallel steps both contribute to downstream context

- **WHEN** step A completes with `outputs: { a: 1 }`, step B completes with `outputs: { b: 2 }`, and step C has `dependsOn: ['A', 'B']`
- **THEN** when C runs, its context SHALL include `a: 1` and `b: 2` (and initial params)
- **AND** later-overwrites semantics apply if A and B wrote the same key

### Requirement: RunResult SHALL reflect executed steps only

The run result (e.g. `RunResult.steps`) SHALL list only steps that were actually executed (i.e. had `dependsOn` and were part of the DAG). The order in the result MAY be execution order (or completion order), not necessarily the order in the YAML steps array. Orphan steps SHALL NOT appear in the result (or SHALL be marked as skipped/orphan as defined by implementation).

#### Scenario: Result order follows execution order

- **WHEN** the DAG executes steps in order X, Y, Z (due to dependencies)
- **THEN** the returned steps array SHALL contain StepResults for X, Y, Z
- **AND** the order SHALL reflect execution (or completion) order, not the original steps array order

#### Scenario: Orphan steps not in result

- **WHEN** a flow has three steps: one with `dependsOn: ['entry']`, one with no dependsOn, and one with `dependsOn: ['first']`
- **THEN** the step with no dependsOn SHALL NOT be executed
- **AND** the run result SHALL NOT include a StepResult for that orphan step
