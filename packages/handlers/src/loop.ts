// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '@runflow/core'
import { evaluateToBoolean, normalizeStepIds } from '@runflow/core'
import { computeLoopClosure } from './loopClosure'

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
      ...normalizeStepIds(step.end),
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
    let closureIds = computeLoopClosure(flowSteps, entryIds, step.id)
    const doneIds = normalizeStepIds(step.done)
    const endIds = normalizeStepIds(step.end as string | string[] | undefined)
    const doneOrEndSet = new Set([...doneIds, ...endIds])
    const entrySet = new Set(entryIds)
    if (doneOrEndSet.size > 0)
      closureIds = closureIds.filter(id => !doneOrEndSet.has(id) || entrySet.has(id))
    if (closureIds.length === 0) {
      return context.stepResult(step.id, false, {
        error: 'loop closure is empty; ensure entry ids exist in the flow and have valid dependsOn',
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
    const completedStepIds = [...closureIds]
    let ctx: Record<string, unknown> = { ...context.params }
    let stepSuccess = true
    let iterationCount = 0

    const runBody = async (bodyCtx: Record<string, unknown>) => runSubFlow(closureIds, bodyCtx, step.id)

    if (Array.isArray(step.items)) {
      const items = step.items
      for (let index = 0; index < items.length; index++) {
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
          })
        }
      }
      return context.stepResult(step.id, stepSuccess, {
        outputs: { ...ctx, count: items.length, items: [...items] },
        nextSteps: doneIds.length > 0 ? doneIds : undefined,
        completedStepIds,
      })
    }

    const countNum = parseCount(step.count)
    if (countNum !== null) {
      const n = countNum
      for (let index = 0; index < n; index++) {
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
          })
        }
      }
      return context.stepResult(step.id, stepSuccess, {
        outputs: { ...ctx, count: iterationCount },
        nextSteps: doneIds.length > 0 ? doneIds : undefined,
        completedStepIds,
      })
    }

    if (typeof step.when === 'string' && step.when.length > 0) {
      const whenExpr = step.when
      const maxIterations = (typeof step.maxIterations === 'number' && step.maxIterations > 0)
        ? Math.min(step.maxIterations, DEFAULT_MAX_LOOP_ITERATIONS)
        : DEFAULT_MAX_LOOP_ITERATIONS
      while (iterationCount < maxIterations) {
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
          })
        }
        try {
          if (evaluateToBoolean(whenExpr, ctx as Record<string, unknown>, { maxLength: 2000 })) {
            return context.stepResult(step.id, stepSuccess, {
              outputs: { ...ctx, count: iterationCount },
              nextSteps: doneIds.length > 0 ? doneIds : undefined,
              completedStepIds,
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
      })
    }

    return context.stepResult(step.id, false, { error: 'loop step requires one of: items, count, or when' })
  }
}
