# loop-step (Delta): 每輪結束點、完整 closure、離開 loop 單一規則

## Purpose

以**每輪結束點（end）**為核心：迭代範圍為從 entry 的完整 closure；end 表示「一輪結束」的節點（可推斷為 closure 的 sink），不用來過濾 closure。每輪跑完 closure 後依 when/items/count 決定 done 或下一輪；僅當某步 nextSteps 指向 closure 外時，loop 結束且不跑 done。不需單獨「判斷 early exit」，僅區分「一輪正常結束」與「控制離開本輪」。

## MODIFIED Requirements

### Requirement: Iteration scope SHALL be the closure from entry minus done; end SHALL denote round end and SHALL NOT filter closure

The iteration scope SHALL be the **full forward transitive closure** from entry, **minus** (1) any step id listed in `done` and (2) any step in the closure that **transitively depends on** a done step. The engine SHALL NOT remove any step id from this closure based on `end` alone. Done and its downstream steps SHALL be excluded from the iteration body so they run **once** when the loop returns nextSteps (after all rounds complete); otherwise steps like `req` (dependsOn: [nap]) would run every round with nap falsely treated as completed. The **end** field (when present) SHALL denote the **round end**; when absent, the engine or UI MAY infer end as the **sink(s) of the closure** (e.g. steps in closure that no other step in closure depends on). End is for visualization only; it SHALL NOT be used to exclude steps from the closure. Each iteration SHALL run the body (closure minus done) as the sub-flow (runSubFlow(bodyStepIds)) until either the run returns normally (round complete) or returns with nextSteps pointing outside the body (control leaves the round).

#### Scenario: Full closure each round minus done; end as round end only

- **GIVEN** a loop step with `entry: [loopBody]`, `done: [nap]`, closure from loopBody includes loopBody, earlyExitCond, noop, nap2, nap (nap has dependsOn: [loop])
- **WHEN** the executor runs the loop
- **THEN** the handler SHALL pass body = closure minus (done ∪ steps that transitively depend on done) (e.g. [loopBody, earlyExitCond, noop, nap2]; nap, req, sub, summary excluded) to runSubFlow each iteration
- **AND** the handler SHALL exclude `done` and any step that depends on done (transitively) from the iteration body so they run once when the loop returns nextSteps
- **AND** the handler SHALL NOT exclude any step id based on `end` alone
- **AND** when `end` is omitted, the engine or UI MAY infer end as the sink nodes of the closure (e.g. [noop, nap2])

### Requirement: Round complete vs control leaves round; done only on round complete

- **Round complete**：When runSubFlow(closureIds) returns **without** earlyExit (no step returned nextSteps containing a step id outside the closure), the round SHALL be considered complete. The engine SHALL then evaluate when/items/count; if the loop is done (items exhausted, count reached, or when expression true), the loop step SHALL return `nextSteps: done` and the executor SHALL run done steps once. Otherwise the engine SHALL run the next round (runSubFlow again).
- **Control leaves round**：When runSubFlow returns **with** earlyExit (a step returned nextSteps that include a step id **not** in the closure), the loop SHALL complete immediately with that same nextSteps. The executor SHALL continue with those steps. The loop step SHALL NOT return done; done SHALL NOT be run. No separate "early exit" decision is required — the runSubFlow earlyExit result is the only condition for "control left the round".

#### Scenario: Round complete then done

- **GIVEN** a loop step with `count: 2`, `entry: [A]`, `done: [D]`, closure {A, B, C}; no step returns nextSteps outside the closure
- **WHEN** runSubFlow runs twice and each time returns normally
- **THEN** after the second round the loop SHALL return `nextSteps: [D]`; the executor SHALL run D once

#### Scenario: Control leaves round; done is not run

- **GIVEN** a loop step with `entry: [A]`, `done: [D]`, closure {A, B, C}; step B returns `nextSteps: [out]` where out is not in the closure
- **WHEN** B returns that nextSteps during an iteration
- **THEN** runSubFlow SHALL return earlyExit with that nextSteps; the loop SHALL complete with `nextSteps: [out]`
- **AND** the executor SHALL continue with step out; step D (done) SHALL NOT be run

## ADDED Requirements

### Requirement: When end is omitted, engine MAY infer end as closure sinks

When the loop step does not specify `end`, the engine or UI MAY compute the set of step ids that are sinks of the closure and use that set as the inferred end for visualization and for the "round end" semantic. This inference SHALL NOT change which steps are run; the full closure SHALL still be run each iteration.

#### Scenario: Infer end when omitted

- **GIVEN** a loop step with `entry: [loopBody]` and no `end` field; closure is {loopBody, earlyExitCond, noop, nap2} where noop and nap2 are sinks
- **WHEN** the engine or UI needs an end set (e.g. for drawing or round-end semantic)
- **THEN** it MAY infer end as [noop, nap2]
- **AND** the handler SHALL still run the full closure each iteration
