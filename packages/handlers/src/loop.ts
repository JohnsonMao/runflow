// @env node
import type { FlowDefinition, FlowStep, IStepHandler, RunResult, StepContext, StepResult } from '@runflow/core'
import { normalizeStepIds } from '@runflow/core'
import { closureIdsThatDependOnDone, computeLoopClosure } from './loopClosure'

/** Build a sub-flow from body step ids: same steps with dependsOn restricted to body (self-contained DAG). */
function buildSubFlow(flowSteps: FlowStep[], bodyStepIds: string[]): FlowDefinition {
  const scopeSet = new Set(bodyStepIds)
  const steps = flowSteps
    .filter(s => scopeSet.has(s.id))
    .map(s => ({
      ...s,
      dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.filter(dep => scopeSet.has(dep)) : [],
    }))
  return { steps }
}

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
  validate(step: FlowStep): true | string {
    const hasItems = Array.isArray(step.items)
    const hasCount = parseCount(step.count) !== null
    const driverCount = (hasItems ? 1 : 0) + (hasCount ? 1 : 0)
    if (driverCount === 0)
      return 'loop step requires exactly one of: items (array), or count (non-negative number)'
    if (driverCount > 1)
      return 'loop step must have exactly one of: items, or count (not both)'
    const entryIds = normalizeStepIds(step.entry)
    if (entryIds.length === 0)
      return 'loop step requires entry (non-empty step id or array of ids)'
    const sigs = step.iterationCompleteSignals
    if (sigs !== undefined && !Array.isArray(sigs))
      return 'loop step iterationCompleteSignals must be an array of step ids'
    return true
  }

  kill(): void {}

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    const runFn = context.run
    const entryIds = normalizeStepIds(step.entry)
    const flowSteps = context.steps
    const iterationCompleteSignals = Array.isArray(step.iterationCompleteSignals) ? step.iterationCompleteSignals : []

    if (!runFn) {
      return context.stepResult(step.id, false, { error: 'run not available (loop requires context.run)' })
    }
    if (!flowSteps || flowSteps.length === 0) {
      return context.stepResult(step.id, false, {
        error: 'loop step requires steps on context (provided by executor)',
      })
    }

    const closureIds = computeLoopClosure(flowSteps, entryIds, step.id)
    const doneIds = normalizeStepIds(step.done)

    const excludedFromBody = closureIdsThatDependOnDone(flowSteps, closureIds, doneIds)
    const loopBodySteps = closureIds.filter(id => !excludedFromBody.has(id))

    if (loopBodySteps.length === 0) {
      return context.stepResult(step.id, false, {
        error: 'loop closure is empty (or only done steps); ensure entry ids exist and are not all in done',
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

    let ctx: Record<string, unknown> = { ...context.params }
    let stepSuccess = true
    let iterationCount = 0
    const subSteps: StepResult[] = []

    const runBody = async (bodyCtx: Record<string, unknown>): Promise<RunResult> => {
      const subFlow = buildSubFlow(flowSteps, loopBodySteps)
      return runFn(subFlow, bodyCtx)
    }

    const pushIterationSubSteps = (iterationIndex: number, runResult: RunResult) => {
      const prefix = `${step.id}.iteration_${iterationIndex + 1}`
      subSteps.push({ stepId: prefix, success: true })
      for (const s of runResult.steps)
        subSteps.push({ ...s, stepId: `${prefix}.${s.stepId}` })
    }

    const checkIterationCompleteSignal = (runResult: RunResult): boolean => {
      if (iterationCompleteSignals.length === 0) {
        return runResult.success
      }

      // Check if any executed step in the sub-DAG is one of the signal steps
      for (const s of runResult.steps) {
        if (s.success && iterationCompleteSignals.includes(s.stepId)) {
          return true
        }
      }
      return false
    }

    // --- Items Driver ---
    if (Array.isArray(step.items)) {
      const items = step.items
      for (let index = 0; index < items.length; index++) {
        const bodyCtx = { ...ctx, item: items[index], index, items }
        const out = await runBody(bodyCtx)

        pushIterationSubSteps(index, out)

        if (out.nextSteps === null) {
          // If sub-flow signals immediate termination, propagate it.
          return context.stepResult(step.id, out.success, {
            error: out.error,
            outputs: out.finalParams ?? ctx,
            nextSteps: null, // Propagate the null signal
            subSteps, // accumulated subSteps
          })
        }

        ctx = out.finalParams ?? ctx
        if (!out.success) // Check sub-flow success
          stepSuccess = false

        if (!checkIterationCompleteSignal(out)) {
          // If signal not reached and signals are mandatory, terminate loop early
          return context.stepResult(step.id, stepSuccess, {
            outputs: { ...ctx, count: iterationCount + 1, items: [...items] },
            subSteps,
            nextSteps: null,
            log: `loop terminated early after ${iterationCount + 1} iteration(s) (no completion signal reached)`,
          })
        }
        iterationCount++
      }
      // Normal completion
      return context.stepResult(step.id, stepSuccess, {
        outputs: { ...ctx, count: items.length, items: [...items] },
        nextSteps: stepSuccess ? (doneIds.length > 0 ? doneIds : undefined) : null,
        subSteps,
        log: `done, ${items.length} iteration(s)`,
      })
    }

    // --- Count Driver ---
    const countNum = parseCount(step.count)
    if (countNum !== null) {
      const n = countNum
      for (let index = 0; index < n; index++) {
        const bodyCtx = { ...ctx, index, count: n }
        const out = await runBody(bodyCtx)

        pushIterationSubSteps(index, out)

        if (out.nextSteps === null) {
          // If sub-flow signals immediate termination, propagate it.
          return context.stepResult(step.id, out.success, {
            error: out.error,
            outputs: out.finalParams ?? ctx,
            nextSteps: null, // Propagate the null signal
            subSteps, // accumulated subSteps
          })
        }

        ctx = out.finalParams ?? ctx
        if (!out.success) // Check sub-flow success
          stepSuccess = false

        if (!checkIterationCompleteSignal(out)) {
          // If signal not reached and signals are mandatory, terminate loop early
          return context.stepResult(step.id, stepSuccess, {
            outputs: { ...ctx, count: iterationCount + 1 },
            subSteps,
            nextSteps: null,
            log: `loop terminated early after ${iterationCount + 1} iteration(s) (no completion signal reached)`,
          })
        }
        iterationCount++
      }
      // Normal completion
      return context.stepResult(step.id, stepSuccess, {
        outputs: { ...ctx, count: iterationCount },
        nextSteps: stepSuccess ? (doneIds.length > 0 ? doneIds : undefined) : null,
        subSteps,
        log: `done, ${iterationCount} iteration(s)`,
      })
    }

    return context.stepResult(step.id, false, { error: 'loop step requires one of: items, or count' })
  }
}
