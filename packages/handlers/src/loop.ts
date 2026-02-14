// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '@runflow/core'
import { evaluateToBoolean, normalizeStepIds } from '@runflow/core'
import { closureIdsThatDependOnDone, computeBackwardClosure, computeLoopClosure } from './loopClosure'

/** Max iterations for when-driven loops to prevent infinite loop DoS. */
export const DEFAULT_MAX_LOOP_ITERATIONS = 10_000

/** Parse count from step (number or numeric string from template substitution). */
function parseCount(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0)
    return Math.floor(v)
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0)
      return Math.floor(n)
  }
  return null
}

export class LoopHandler implements IStepHandler {
  getAllowedDependentIds(step: FlowStep): string[] {
    return [
      ...normalizeStepIds(step.entry),
      ...normalizeStepIds(step.done),
      ...normalizeStepIds(step.connect),
    ]
  }

  validate(step: FlowStep): true | string {
    const hasItems = Array.isArray(step.items)
    const hasCount = parseCount(step.count) !== null
    const hasWhen = typeof step.when === 'string' && step.when.length > 0
    const driverCount = (hasItems ? 1 : 0) + (hasCount ? 1 : 0) + (hasWhen ? 1 : 0)
    if (driverCount === 0)
      return 'loop step requires exactly one of: items (array), count (non-negative number), or when (expression)'
    if (driverCount > 1)
      return 'loop step must have exactly one of: items, count, or when (not multiple)'
    const entryIds = normalizeStepIds(step.entry)
    if (entryIds.length === 0)
      return 'loop step requires entry (non-empty step id or array of ids)'
    return true
  }

  kill(): void {}

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    const runSubFlow = context.runSubFlow
    const entryIds = normalizeStepIds(step.entry)
    const flowSteps = context.steps
    if (!flowSteps || flowSteps.length === 0) {
      return context.stepResult(step.id, false, {
        error: 'loop step requires steps on context (provided by executor)',
      })
    }
    const closureIds = computeLoopClosure(flowSteps, entryIds, step.id)
    const doneIds = normalizeStepIds(step.done)
    const connectIds = normalizeStepIds(step.connect)
    let bodyStepIds: string[]
    if (connectIds.length > 0) {
      // connect 定義一輪的終點：closure = 從 entry 到 connect 的路徑 = forward(entry) ∩ backward(connect)
      const backward = computeBackwardClosure(flowSteps, connectIds)
      bodyStepIds = closureIds.filter(id => backward.has(id))
    }
    else {
      // 無 connect 時沿用：排除 done 及其下游
      const excludedFromBody = closureIdsThatDependOnDone(flowSteps, closureIds, doneIds)
      bodyStepIds = closureIds.filter(id => !excludedFromBody.has(id))
    }
    if (bodyStepIds.length === 0) {
      return context.stepResult(step.id, false, {
        error: connectIds.length > 0
          ? 'loop closure is empty; ensure entry can reach connect (path entry → connect)'
          : 'loop closure is empty (or only done steps); ensure entry ids exist and are not all in done',
      })
    }
    const closureSet = new Set(closureIds)
    for (const eid of entryIds) {
      if (!closureSet.has(eid)) {
        return context.stepResult(step.id, false, {
          error: `loop entry id "${eid}" is not in the computed closure; ensure it exists in the flow`,
        })
      }
    }
    // Only body steps were run inside the loop; done and its downstream run after loop returns nextSteps.
    const completedStepIds = [...bodyStepIds]
    let ctx: Record<string, unknown> = { ...context.params }
    let stepSuccess = true
    let iterationCount = 0

    const runBody = async (bodyCtx: Record<string, unknown>) => runSubFlow(bodyStepIds, bodyCtx)

    if (Array.isArray(step.items)) {
      const items = step.items
      for (let index = 0; index < items.length; index++) {
        context.pushMarkerStep?.(`${step.id}.iteration_${index + 1}`)
        const bodyCtx = { ...ctx, item: items[index], index, items }
        const out = await runBody(bodyCtx)
        ctx = out.newContext
        if (stepSuccess && out.results.some(r => !r.success))
          stepSuccess = false
        iterationCount++
        if (out.earlyExit) {
          return context.stepResult(step.id, stepSuccess, {
            outputs: { ...ctx, count: iterationCount, items: [...items] },
            nextSteps: out.earlyExit.nextSteps,
            completedStepIds,
            log: `early exit after ${iterationCount} iteration(s)`,
          })
        }
      }
      return context.stepResult(step.id, stepSuccess, {
        outputs: { ...ctx, count: items.length, items: [...items] },
        nextSteps: doneIds.length > 0 ? doneIds : undefined,
        completedStepIds,
        log: `done, ${items.length} iteration(s)`,
      })
    }

    const countNum = parseCount(step.count)
    if (countNum !== null) {
      const n = countNum
      for (let index = 0; index < n; index++) {
        context.pushMarkerStep?.(`${step.id}.iteration_${index + 1}`)
        const bodyCtx = { ...ctx, index, count: n }
        const out = await runBody(bodyCtx)
        ctx = out.newContext
        if (stepSuccess && out.results.some(r => !r.success))
          stepSuccess = false
        iterationCount++
        if (out.earlyExit) {
          return context.stepResult(step.id, stepSuccess, {
            outputs: { ...ctx, count: iterationCount },
            nextSteps: out.earlyExit.nextSteps,
            completedStepIds,
            log: `early exit after ${iterationCount} iteration(s)`,
          })
        }
      }
      return context.stepResult(step.id, stepSuccess, {
        outputs: { ...ctx, count: iterationCount },
        nextSteps: doneIds.length > 0 ? doneIds : undefined,
        completedStepIds,
        log: `done, ${iterationCount} iteration(s)`,
      })
    }

    if (typeof step.when === 'string' && step.when.length > 0) {
      const whenExpr = step.when
      const maxIterations = (typeof step.maxIterations === 'number' && step.maxIterations > 0)
        ? Math.min(step.maxIterations, DEFAULT_MAX_LOOP_ITERATIONS)
        : DEFAULT_MAX_LOOP_ITERATIONS
      while (iterationCount < maxIterations) {
        context.pushMarkerStep?.(`${step.id}.iteration_${iterationCount + 1}`)
        const bodyCtx = { ...ctx, index: iterationCount, count: maxIterations }
        const out = await runBody(bodyCtx)
        ctx = out.newContext
        if (stepSuccess && out.results.some(r => !r.success))
          stepSuccess = false
        iterationCount++
        if (out.earlyExit) {
          return context.stepResult(step.id, stepSuccess, {
            outputs: { ...ctx, count: iterationCount },
            nextSteps: out.earlyExit.nextSteps,
            completedStepIds,
            log: `early exit after ${iterationCount} iteration(s)`,
          })
        }
        try {
          if (evaluateToBoolean(whenExpr, ctx as Record<string, unknown>, { maxLength: 2000 })) {
            return context.stepResult(step.id, stepSuccess, {
              outputs: { ...ctx, count: iterationCount },
              nextSteps: doneIds.length > 0 ? doneIds : undefined,
              completedStepIds,
              log: `done, ${iterationCount} iteration(s)`,
            })
          }
        }
        catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return context.stepResult(step.id, false, {
            error: `loop when expression failed: ${msg}`,
            outputs: { ...ctx, count: iterationCount },
            completedStepIds,
          })
        }
      }
      return context.stepResult(step.id, false, {
        error: `loop when exceeded max iterations (${maxIterations})`,
        outputs: { ...ctx, count: iterationCount },
        completedStepIds,
        log: `exceeded max iterations (${maxIterations})`,
      })
    }

    return context.stepResult(step.id, false, { error: 'loop step requires one of: items, count, or when' })
  }
}
