## 1. Types and flow shape

- [x] 1.1 Add optional `dependsOn?: string[]` to `FlowStep` in packages/core/src/types.ts (or extend the generic shape so parser preserves it)
- [x] 1.2 Ensure condition step fields (`when`, `then`, `else`) are preserved on FlowStep via existing `[key: string]: unknown`; no new type alias required unless design adds one

## 2. DAG utilities

- [x] 2.1 Add a DAG module (e.g. dag.ts): build graph from steps that have `dependsOn` (present and array); steps with no `dependsOn` field are excluded; steps with `dependsOn: []` are roots
- [x] 2.2 Implement topological sort and cycle detection; export function that returns ordered step ids or error (cycle / missing id)
- [x] 2.3 Add unit tests for DAG: linear chain, parallel branches, cycle detection, orphan exclusion, empty dependsOn as root

## 3. Parser and validation

- [x] 3.1 Parser: accept and preserve `dependsOn` on each step (array of strings); no parse-time validation of step id references
- [x] 3.2 Add validation (in core, callable before run): all step ids in `dependsOn` must exist in the set of step ids that have `dependsOn` (or reject dependency on orphan); detect cycle; return clear error message
- [x] 3.3 Export validation or integrate into run() so run() fails fast with invalid DAG

## 4. Executor DAG execution

- [x] 4.1 In run(): build DAG from flow.steps (only steps with dependsOn field); run validation (cycle, missing ids); on failure return RunResult with error and no steps
- [x] 4.2 Compute execution order (topological order) and execute in waves: all steps with satisfied dependencies run (Phase 1: sequentially per wave; optionally Phase 2: Promise.all per wave)
- [x] 4.3 After each step (or wave), merge StepResult.outputs into context; pass updated context to next step(s)
- [x] 4.4 Collect only executed steps into RunResult.steps in execution (or completion) order; do not include orphan steps
- [x] 4.5 dry-run: build DAG, validate, optionally output planned step order; do not execute handlers
- [x] 4.6 Update executor tests: linear DAG, parallel DAG, orphan steps excluded, cycle returns error, invalid reference returns error

## 5. Condition handler

- [x] 5.1 Add packages/core/src/handlers/condition.ts: implement IStepHandler for type 'condition'
- [x] 5.2 Validate step has `when` (string); if missing, return StepResult success: false with error message
- [x] 5.3 Evaluate `when` after substitution: use safe expression evaluator (or vm) with context only; result as boolean; on throw return StepResult success: false
- [x] 5.4 Return StepResult with success: true and nextSteps (then/else step ids); do not return outputs so context is not polluted
- [x] 5.5 Register condition handler in createDefaultRegistry() in registry.ts
- [x] 5.6 Add unit tests for condition handler: when true/false, missing when, evaluation error, output in context

## 6. Flow schema and examples

- [x] 6.1 Update flow.schema.json (or generate-flow-schema source) to include optional `dependsOn` on steps and condition step shape (when required, then/else optional)
- [x] 6.2 Add example flow YAML: DAG with dependsOn (e.g. linear and one with parallel branch) under examples/
- [x] 6.3 Add example flow YAML: condition step with when and steps depending on it, under examples/

## 7. CLI and docs

- [x] 7.1 Ensure CLI run command still works with DAG flows (no CLI changes required unless adding --output order or dry-run DAG preview)
- [x] 7.2 Update README: document DAG execution, dependsOn, orphan rule, condition step; add migration note for existing flows (add dependsOn to every step that must run)
- [x] 7.3 Run full check: pnpm run typecheck, lint, test
