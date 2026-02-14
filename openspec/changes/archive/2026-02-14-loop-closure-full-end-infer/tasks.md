# Tasks: loop-closure-full-end-infer

## 1. Loop handler: 不依 end/done 過濾 closure

- [x] 1.1 In `packages/handlers/src/loop.ts`, remove the logic that filters `closureIds` by `doneOrEndSet` (i.e. remove `doneIds`, `endIds`, `doneOrEndSet`, and the filter `closureIds = closureIds.filter(id => !doneOrEndSet.has(id) || entrySet.has(id))`). Closure SHALL be only `computeLoopClosure(flowSteps, entryIds, step.id)`.
- [x] 1.2 Keep validation that closure is non-empty and contains all entry ids; fail with clear error if not.

## 2. 可選：end 推斷

- [x] 2.1 When `step.end` is not provided, handler or callers MAY infer end as closure sinks for display/docs; no change required to runSubFlow body (closure is already full).

## 3. 可選：迭代 log 順序

- [x] 3.1 Consider moving `context.appendLog?.(`iteration ${i}/${n}`)` to after `runBody()` for each iteration so that the loop step's log reads: loop start, then iteration 1/N, then iteration 2/N, ... (conceptually after each iteration's body). Current order (before runBody) is acceptable if not changed.

## 4. 測試與檢查

- [x] 4.1 Update or add loop tests: full closure is run (noop/nap2 included when in closure); early exit returns nextSteps and does not run done.
- [x] 4.2 Run `pnpm run check` and fix any regressions.
- [x] 4.3 Optionally update tt/test.yaml: remove `end: [nap2]` if desired (closure will include nap2; behavior unchanged for early exit to nap2 if nap2 is inside closure — then nap2 runs inside the iteration, and early exit only when nextSteps points outside closure).
