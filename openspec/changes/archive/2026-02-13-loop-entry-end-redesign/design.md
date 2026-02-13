# Loop Entry / End Redesign — Design

## Context

- **Current state**: Loop step uses `body` (full list of step ids per iteration), `done` (nextSteps on normal completion), and optionally `exitWhen`/`exitThen`. The executor's `runSubFlow(bodyStepIds, ctx, callerStepId)` runs only the given `bodyStepIds` in DAG order; the loop handler passes `normalizeStepIds(step.body)` as that list. The handler does not have access to the flow's full step list—only `context.params`, `runSubFlow`, `stepResult`, etc.
- **Constraint**: Closure must be derived from the flow DAG (steps + dependsOn). The loop handler runs inside the executor and cannot see other steps unless the executor exposes them (or a derived API).
- **Stakeholders**: Core (executor), handlers (loop), flow authors, UI/MCP for closed-loop drawing.

## Goals / Non-Goals

**Goals:**

- Implement **entry** as entry point(s) only; iteration scope = forward closure from entry.
- Remove **body**, **exitWhen**, **exitThen**; keep **done**; add optional **end** (visualization).
- Compute closure in one place (core) and have the loop handler call `runSubFlow(closureIds, ...)`.
- Early exit: any step in the closure returning nextSteps outside the closure ends the iteration and the loop with that nextSteps (whole iteration stops).

**Non-Goals:**

- Changing how runSubFlow or getRunnable work (besides the ids passed in).
- Implementing UI/MCP closed-loop drawing (only specify contract: use end if present, else infer sinks of closure).
- Supporting backward compatibility for `body` / `exitWhen` / `exitThen` (breaking change).

## Decisions

### 1. Where to compute closure: in core, exposed via StepContext

- **Choice**: Add a function in **@runflow/core** that computes the forward closure from (steps, entryIds, loopStepId). The **executor** provides this to the loop handler via StepContext (e.g. `getLoopClosure(entryIds: string[], loopStepId: string): string[]`). The loop handler calls it once at the start of run(), then uses the returned ids as the scope for runSubFlow.
- **Rationale**: The handler does not have the flow steps today; passing the full step list or stepByIdMap on context would widen the API. A single purpose-built helper keeps the contract minimal and the closure rule in one place (core), so UI/MCP can reuse the same logic for inferring end.
- **Alternatives considered**: (a) Handler receives `context.steps` and computes closure in the handler—rejected because it would duplicate DAG logic and require steps to be part of the public context. (b) Executor computes closure before calling the handler and passes it in step—rejected because it would require the executor to know loop-specific fields (entry, loop id), coupling executor to loop shape.

### 2. Closure algorithm (forward, fixed point)

- **Rule**: Start with `scope = new Set(entryIds)`. Repeatedly: for each step S in the flow, if S is not in scope and every id in `S.dependsOn` is either the loop step id or in scope, add S to scope. Stop when no change. Only consider steps that exist in the flow; ignore missing or invalid dependsOn.
- **Rationale**: Matches proposal: "every step in S's dependsOn is either L or in scope". Implementable as a single pass over steps in a loop until stable (bounded by number of steps).
- **Alternatives**: Topological order then single forward pass—equivalent for a DAG; we use fixed point for clarity and to avoid depending on global order.

### 3. StepContext extension: getLoopClosure

- **Choice**: Add optional `getLoopClosure?: (entryIds: string[], loopStepId: string) => string[]` on StepContext. The executor sets it when building context (it has stepByIdMap and flow.steps). Loop handler: if `context.getLoopClosure` is absent, fail with a clear error (e.g. "loop requires executor to provide getLoopClosure").
- **Rationale**: Optional so that tests or other runners can omit it; loop handler validates and fails fast. Implementation in executor: call a pure `computeLoopClosure(steps, entryIds, loopStepId)` from core.

### 4. Core export: computeLoopClosure + inferLoopEndSinks

- **Choice**: In @runflow/core, add:
  - `computeLoopClosure(steps: FlowStep[], entryIds: string[], loopStepId: string): string[]`
  - `inferLoopEndSinks(steps: FlowStep[], closureIds: string[]): string[]` (sinks of the closure for UI; not used by handler at runtime)
- **Rationale**: Single source of truth for closure and for inferred end; UI/MCP can call `inferLoopEndSinks(flow.steps, computeLoopClosure(...))` when end is omitted.

### 5. Loop handler: validate entry only; run with closure

- **Choice**: Validate: `entry` required (one or more ids), optional `end` and `done`; reject `body`, `exitWhen`, `exitThen`. In run(): entryIds = normalizeStepIds(step.entry); closureIds = context.getLoopClosure(entryIds, step.id); then runSubFlow(closureIds, bodyCtx, step.id) per iteration. Remove all exitWhen/exitThen logic.
- **Rationale**: Keeps handler simple; closure is the only "body" passed to runSubFlow. Early exit is already handled by runSubFlow when a step returns nextSteps outside the scope (closureIds).

### 6. end: not used at runtime

- **Choice**: Loop step may have `end` (step id or array). Handler does not use it for execution. Only UI/MCP use it: if present, draw closed loop from end to loop node; if absent, use inferLoopEndSinks(flow.steps, closure) for the same.
- **Rationale**: Proposal states end is for visualization only; execution always runs the full closure.

## Risks / Trade-offs

- **[Risk] getLoopClosure not provided** → Handler returns StepResult success: false with error "loop requires getLoopClosure on context". Migration: ensure all runners that support loop pass getLoopClosure (executor does).
- **[Risk] Closure is empty or does not contain entry** → If entry ids are invalid or not in the flow, closure could be empty or miss entry. Mitigation: validate that every entry id exists in the flow (handler or executor); after computeLoopClosure, if closure is empty or does not include all entry ids, fail with a clear error.
- **[Risk] dependsOn references step outside flow** → Closure only adds steps that are in the flow; steps with dependsOn pointing to missing ids may never be added. Mitigation: document that entry and its transitive deps must be present in the same flow; validation can optionally check that closure is non-empty and contains entry.
- **[Trade-off] Breaking change** → All existing flows using body/exitWhen/exitThen must migrate. Mitigation: migration plan (see below); release note and optional codemod or docs for body→entry and removal of exitWhen/exitThen.

## Migration Plan

1. **Implement in core**: Add `computeLoopClosure`, `inferLoopEndSinks`; add `getLoopClosure` on StepContext in executor (using flow.steps and step.id for loop steps).
2. **Implement in handlers**: Loop handler switch to entry/end/done; remove body, exitWhen, exitThen; use context.getLoopClosure(entryIds, step.id) and runSubFlow(closureIds, ...).
3. **Update flow YAML**: Migrate existing flows: replace `body` with `entry` (can be the same list for a first pass, or reduce to true entry points only); remove exitWhen/exitThen; add `end` only if desired for diagram.
4. **Tests**: Update loop tests to use entry; add tests for closure (single entry, multiple entry, closure larger than entry); add tests for getLoopClosure missing.
5. **Rollback**: Revert handler and executor changes; restore body/exitWhen/exitThen in code and in flows if needed (no DB; flow files are source of truth).

## Open Questions

- Whether to validate in the handler that closure contains all entry ids and is non-empty (recommended: yes).
- Whether the executor should validate that step.entry ids exist in the flow before calling the handler (recommended: optional; handler can fail with a clear message if closure is empty).
