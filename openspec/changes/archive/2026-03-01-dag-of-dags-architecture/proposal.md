## Why
The current core engine implementation tightly couples general DAG execution with specific loop handling logic, such as `scopeStepIds` and `earlyExit`. This results in a complex and fragile codebase where the engine must "know" too much about the structure of its steps. By refactoring this into a "DAG of DAGs" architecture, we can move all structural and iterative logic (like loops) into their respective step handlers. This simplification will make the engine more robust, predictable, and easier to extend with new structural step types.

## What Changes
- Refactor the core engine (`packages/core/src/engine.ts`) to be purely a DAG executor. It should only be responsible for executing the steps in its immediate DAG and returning results.
- **BREAKING**: Move loop-specific execution logic (calculating the loop closure, building the sub-flow, and managing iterations) entirely into the `LoopHandler` (`packages/handlers/src/loop.ts`).
- Standardize the hand-off between the engine and handlers for nested execution. Handlers that act as "containers" will be responsible for defining and running their own sub-DAGs.
- Update the `IStepHandler` interface or `StepResult` if necessary to better support this separation.
- Adjust core and loop tests to reflect the new architecture.

## Capabilities

### New Capabilities
- `dag-of-dags-execution`: Support for hierarchical execution where any step handler can independently manage its own sub-DAG, promoting a cleaner recursive structure.

### Modified Capabilities
- `loop-step`: Requirement for the loop handler to encapsulate its closure calculation and iteration logic, rather than relying on the engine's `scopeStepIds`.

## Impact
- `packages/core`: Significant simplification of `engine.ts` and potentially `dag.ts`.
- `packages/handlers`: Refactoring `loop.ts` to take full ownership of its execution lifecycle.
- Potential updates to `types.ts` to accommodate cleaner hand-offs between engine and handlers.
