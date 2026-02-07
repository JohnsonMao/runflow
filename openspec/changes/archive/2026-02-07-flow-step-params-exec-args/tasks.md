# Tasks

## 1. Types and run options

- [x] 1.1 In `packages/core/src/types.ts`: add optional `outputs?: Record<string, unknown>` to `StepResult`.
- [x] 1.2 Define run options type (e.g. `RunOptions`) with `dryRun?: boolean` and `params?: Record<string, string>`; use it in `run(flow, options)` signature.

## 2. Executor: params and context

- [x] 2.1 In `packages/core/src/executor.ts`: accept `options.params` in `run()`; initialize context as copy of `options.params` (or `{}` if omitted).
- [x] 2.2 After each step: if `StepResult.outputs` exists and is a plain object, merge into context with spread (later overwrites).
- [x] 2.3 Pass current context into step execution (js step receives it as vm `params`; command step no change for this task).

## 3. JS step: params and return as outputs

- [x] 3.1 In `runJsStep`: accept a second argument for current context (e.g. `params: Record<string, unknown>`); inject into vm as read-only `params`.
- [x] 3.2 Change js execution to capture return value (e.g. wrap as `(function(){ return (${code}); })()` and read return value); if return value is a plain object and not null, set `result.outputs` to it; otherwise leave `outputs` undefined.
- [x] 3.3 In `run()`: when calling `runJsStep`, pass current context; after the step, merge `result.outputs` into context before the next step.

## 4. CLI: --param

- [x] 4.1 In `apps/cli/src/cli.ts`: add option `--param <key=value>` (or repeatable) to `flow run <file>`; parse each as key=value (first `=` separates), build `Record<string, string>`; duplicate key → later overwrites.
- [x] 4.2 Pass the parsed `params` to `run(flow, { dryRun, params })`.

## 5. Tests (core)

- [x] 5.1 Executor: test `run(flow, { params: { a: '1' } })` — first step (js) sees `params.a === '1'`.
- [x] 5.2 Executor: test js step returns `{ x: 1 }` → `StepResult.outputs` is set and next step’s context includes `x`.
- [x] 5.3 Executor: test context accumulation (e.g. step1 returns `{ a: 's1' }`, step2 sees it and returns `{ b: 's2' }`, step3 sees both).
- [x] 5.4 Executor: test run without params → context empty, existing behavior unchanged.
- [x] 5.5 Executor: test js step returns non-object or no return → no `outputs`, context unchanged for next step.

## 6. Tests (CLI, optional)

- [x] 6.1 CLI: test `flow run <file> --param a=1 --param b=2` passes params to core (e.g. via spy or integration with a minimal flow that echoes params in js step).

## 7. Verify

- [x] 7.1 Run `pnpm test` and `pnpm run check` (typecheck + lint); fix any failures.
- [x] 7.2 Add or run an example flow that uses `--param` and multi-step js with params/outputs to verify end-to-end.
