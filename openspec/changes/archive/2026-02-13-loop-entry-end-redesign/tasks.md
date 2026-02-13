# Loop Entry / End Redesign — Tasks

## 1. Core: closure and sink helpers

- [x] 1.1 Add `computeLoopClosure(steps: FlowStep[], entryIds: string[], loopStepId: string): string[]` in @runflow/core (e.g. in a new file or existing utils/dag), fixed-point: scope = entry; add S if every dep of S is loopStepId or in scope; export from core.
- [x] 1.2 Add `inferLoopEndSinks(steps: FlowStep[], closureIds: string[]): string[]` in @runflow/core (sinks of closure: steps in closure that no other step in closure depends on); export from core.
- [x] 1.3 Add unit tests for computeLoopClosure (single entry chain, multiple entry with merge, empty entry, invalid id).
- [x] 1.4 Add unit tests for inferLoopEndSinks (single sink, multiple sinks).

## 2. Core: StepContext and executor

- [x] 2.1 Extend StepContext in types.ts with optional `getLoopClosure?: (entryIds: string[], loopStepId: string) => string[]`.
- [x] 2.2 In executor, when building stepContext, set getLoopClosure using flow.steps and computeLoopClosure; pass loop step id from the step being run.
- [x] 2.3 Ensure getLoopClosure returns closure that contains all entry ids when they exist in the flow; document or validate empty closure / missing entry.

## 3. Handlers: loop step

- [x] 3.1 Loop handler validate: require `entry` (one or more ids), optional `end` and `done`; reject `body`, `exitWhen`, `exitThen` with clear error messages.
- [x] 3.2 Loop handler run: resolve entryIds = normalizeStepIds(step.entry); call context.getLoopClosure(entryIds, step.id); if absent or closure empty, return StepResult success: false with error.
- [x] 3.3 Loop handler run: pass closure ids to runSubFlow(closureIds, bodyCtx, step.id) for each iteration; remove all exitWhen/exitThen logic and body usage.
- [x] 3.4 Loop handler: keep items/count/until/when drivers and done semantics; ensure early exit uses step's nextSteps (already handled by runSubFlow when nextSteps go outside closure).

## 4. Tests

- [x] 4.1 Update existing loop tests: replace body with entry (use same ids as entry points or minimal entry); remove exitWhen/exitThen tests.
- [x] 4.2 Add loop test: entry A only, closure A→B→C→D, count 2, done E; assert execution order and nextSteps: [E].
- [x] 4.3 Add loop test: entry [A,G] two chains merging at D; assert closure and DAG order.
- [x] 4.4 Add loop test: early exit from step in closure returns nextSteps outside closure; assert loop completes with that nextSteps and no done.
- [x] 4.5 Add loop test: getLoopClosure missing on context → handler returns success: false with error.

## 5. Migration and docs

- [x] 5.1 Migrate workspace flow(s) using loop: test.yaml (and any other) from body/done to entry/done; remove exitWhen/exitThen; add end only if needed for diagram.
- [x] 5.2 Update loop-step main spec (openspec/specs/loop-step/spec.md) with delta content when archiving or syncing.
