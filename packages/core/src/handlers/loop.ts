// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'
import { normalizeStepIds } from '../utils'

export class LoopHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    const hasItems = Array.isArray(step.items)
    const hasCount = typeof step.count === 'number' && Number.isFinite(step.count) && step.count >= 0
    const hasUntil = typeof step.until === 'string' && step.until.length > 0
    const driverCount = (hasItems ? 1 : 0) + (hasCount ? 1 : 0) + (hasUntil ? 1 : 0)
    if (driverCount === 0)
      return 'loop step requires exactly one of: items (array), count (non-negative number), or until (condition step id)'
    if (driverCount > 1)
      return 'loop step must have exactly one of: items, count, or until (not multiple)'
    const bodyIds = normalizeStepIds(step.body)
    if (bodyIds.length === 0)
      return 'loop step requires body (non-empty step id or array of ids)'
    return true
  }

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    const runSubFlow = context.runSubFlow
    const bodyIds = normalizeStepIds(step.body)
    const doneIds = normalizeStepIds(step.done)
    const bodySet = new Set(bodyIds)
    let ctx: Record<string, unknown> = { ...context.params }
    let stepSuccess = true
    let iterationCount = 0

    const runBody = async (bodyCtx: Record<string, unknown>) => runSubFlow(bodyIds, bodyCtx)

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
          })
        }
      }
      return context.stepResult(step.id, stepSuccess, {
        outputs: { ...ctx, count: items.length, items: [...items] },
        nextSteps: doneIds.length > 0 ? doneIds : undefined,
      })
    }

    if (typeof step.count === 'number' && Number.isFinite(step.count) && step.count >= 0) {
      const n = Math.floor(Number(step.count))
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
          })
        }
      }
      return context.stepResult(step.id, stepSuccess, {
        outputs: { ...ctx, count: iterationCount },
        nextSteps: doneIds.length > 0 ? doneIds : undefined,
      })
    }

    if (typeof step.until === 'string' && step.until.length > 0) {
      const untilStepId = step.until
      while (true) {
        const out = await runBody(ctx)
        ctx = out.newContext
        if (stepSuccess && out.results.some(r => !r.success))
          stepSuccess = false
        iterationCount++
        if (out.earlyExit) {
          return context.stepResult(step.id, stepSuccess, {
            outputs: { ...ctx, count: iterationCount },
            nextSteps: out.earlyExit.nextSteps,
          })
        }
        const untilOut = await runSubFlow([untilStepId], ctx)
        ctx = untilOut.newContext
        if (stepSuccess && untilOut.results.some(r => !r.success))
          stepSuccess = false
        const lastUntil = untilOut.results[untilOut.results.length - 1]
        const exitBranch = lastUntil?.nextSteps?.some(id => !bodySet.has(id))
        if (exitBranch) {
          return context.stepResult(step.id, stepSuccess, {
            outputs: { ...ctx, count: iterationCount },
            nextSteps: doneIds.length > 0 ? doneIds : undefined,
          })
        }
      }
    }

    return context.stepResult(step.id, false, { error: 'loop step requires one of: items, count, or until' })
  }
}
