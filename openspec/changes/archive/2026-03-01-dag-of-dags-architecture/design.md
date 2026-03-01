## Context
The current `executeFlow` in `packages/core/src/engine.ts` manages "early exits" via `scopeStepIds`. This was introduced to support the `loop` handler, allowing it to "trap" execution within its body. However, this logic is specific to container-like steps and complicates the core engine.

## Goals / Non-Goals

**Goals:**
- Refactor `executeFlow` to be a pure DAG executor that doesn't need to know about "scopes".
- Enable step handlers (like `LoopHandler`) to fully manage their sub-execution lifecycles.
- Define a standard way for `executeFlow` to report `nextSteps` that fall outside the current DAG.
- Move "early exit" detection from the engine to the container step handlers.

**Non-Goals:**
- Changing the basic YAML structure of flows or steps.
- Performance optimization of the DAG execution (unless regression occurs).

## Decisions

### 1. Engine returns "Unconsumed Next Steps"
`executeFlow` will be modified to track all `nextSteps` returned by steps during execution. Any `nextSteps` that do not target a step within the current `FlowDefinition` will be collected and returned in the `RunResult`.

**Rationale:** This allows the caller (e.g., a `LoopHandler` calling `context.run`) to see where the execution "wanted" to go after the DAG finished or was interrupted.

### 2. Removal of `scopeStepIds` from `RunOptions`
The `scopeStepIds` option will be removed from `RunOptions` and `executeFlow`. The engine will naturally stop when no more steps in its `dagOrder` are runnable.

**Rationale:** Simplifies the engine interface and implementation. "Scope" is implicitly defined by the `FlowDefinition` passed to `executeFlow`.

### 3. LoopHandler manages Early Exit
The `LoopHandler` will check the `unconsumedNextSteps` (or similar field) from the `RunResult` of its sub-flow execution. If such steps exist, it will terminate the loop and return those steps as its own `nextSteps`.

**Rationale:** Moves structural logic to the handler that actually understands the structure.

### 4. Updating `StepResult` and `RunResult` types
- `RunResult` will add `nextSteps?: string[]` to represent steps that were requested but not found in the current flow.
- `RunResult` will remove `earlyExit`.

## Risks / Trade-offs

- **[Risk]** → If a step mistakenly points to a non-existent step, it might be caught by the parent handler as an "early exit" when it was just a typo.
- **[Mitigation]** → Validation (which already exists) should catch typos. The "early exit" logic only applies if the target step exists in the *outer* flow.
- **[Risk]** → Increased complexity in `LoopHandler`.
- **[Mitigation]** → The logic is more localized and follows the "DAG of DAGs" pattern, which is conceptually cleaner.

## Migration Plan
1. Update `types.ts` in `packages/core`.
2. Refactor `engine.ts` to collect unconsumed next steps and remove `scopeStepIds`.
3. Update `LoopHandler` in `packages/handlers` to use the new `RunResult` fields.
4. Update tests in both packages.
