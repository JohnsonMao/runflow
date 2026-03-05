// @env node
import type { FactoryContext, FlowDefinition, FlowStep, RunResult } from '@runflow/core'

/**
 * Compute the forward transitive closure from entry step ids for a loop.
 * Only includes steps that are transitively downstream of entryIds.
 * A step S is added if:
 * 1. It depends on at least one step already in scope.
 * 2. EVERY one of its dependencies is already in scope.
 */
function computeLoopClosure(
  steps: FlowStep[],
  entryIds: string[],
): string[] {
  const scopeSet = new Set(entryIds)

  let changed = true
  while (changed) {
    changed = false
    for (const step of steps) {
      if (scopeSet.has(step.id))
        continue

      const deps = step.dependsOn
      if (!Array.isArray(deps) || deps.length === 0)
        continue

      const hasDepInScope = deps.some(dep => scopeSet.has(dep))
      if (!hasDepInScope)
        continue

      const allInScope = deps.every(dep => scopeSet.has(dep))
      if (allInScope) {
        scopeSet.add(step.id)
        changed = true
      }
    }
  }

  return [...scopeSet]
}

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

function loopHandler({ defineHandler, z, utils }: FactoryContext) {
  return defineHandler({
    type: 'loop',
    schema: z.object({
      items: z.array(z.unknown()).optional(),
      count: z.union([z.number().nonnegative(), z.string()]).optional(),
      entry: z.union([
        z.string().min(1),
        z.array(z.string()).min(1),
      ]).optional(),
      done: z.union([z.string(), z.array(z.string())]).optional(),
      iterationCompleteSignals: z.array(z.string()).optional(),
    }).refine(
      (data) => {
        const hasItems = Array.isArray(data.items)
        const hasCount = parseCount(data.count) !== null
        const driverCount = (hasItems ? 1 : 0) + (hasCount ? 1 : 0)
        return driverCount === 1
      },
      {
        message: 'loop step requires exactly one of: items (array), or count (non-negative number)',
      },
    ),
    flowControl: {
      getAllowedDependentIds: (step) => {
        const entryIds = utils.normalizeStepIds(step.entry)
        const doneIds = utils.normalizeStepIds(step.done)
        return [...entryIds, ...doneIds]
      },
    },
    run: async (context) => {
      const { step, run, steps: flowSteps } = context

      if (!run) {
        return {
          success: false,
          error: 'run not available (loop requires context.run)',
        }
      }

      if (!flowSteps || flowSteps.length === 0) {
        return {
          success: false,
          error: 'loop step requires steps on context (provided by executor)',
        }
      }

      const entryIds = utils.normalizeStepIds(step.entry)
      const doneIds = utils.normalizeStepIds(step.done)

      // 1. Validate no overlap between entry and done
      if (entryIds.length > 0 && doneIds.length > 0) {
        const entrySet = new Set(entryIds)
        const overlap = doneIds.filter(id => entrySet.has(id))
        if (overlap.length > 0) {
          return {
            success: false,
            error: `loop entry and done ids overlap: ${overlap.join(', ')}`,
          }
        }
      }

      // 2. Validate entry step ids exist if provided
      if (entryIds.length > 0) {
        const stepById = new Map(flowSteps.map(s => [s.id, s]))
        const missingIds = entryIds.filter(eid => !stepById.has(eid))
        if (missingIds.length > 0) {
          return {
            success: false,
            error: `loop entry id(s) not found in flow steps: ${missingIds.join(', ')}`,
          }
        }
      }

      // 3. Compute pure loop body closure (starts from entryIds)
      const loopBodySteps = computeLoopClosure(flowSteps, entryIds)

      // 4. Validate done steps are not in the loop body
      if (doneIds.length > 0 && loopBodySteps.length > 0) {
        const bodySet = new Set(loopBodySteps)
        const invalidInBody = doneIds.filter(id => bodySet.has(id))
        if (invalidInBody.length > 0) {
          return {
            success: false,
            error: `loop done id(s) found in loop body closure: ${invalidInBody.join(', ')}. Done steps must be downstream paths separate from the loop body.`,
          }
        }
      }

      const iterationCompleteSignals = Array.isArray(step.iterationCompleteSignals) ? step.iterationCompleteSignals : []

      let ctx: Record<string, unknown> = { ...context.params }
      let stepSuccess = true
      let iterationCount = 0
      const subSteps: RunResult['steps'] = []

      const runBody = async (bodyCtx: Record<string, unknown>): Promise<RunResult> => {
        if (loopBodySteps.length === 0) {
          return { success: true, steps: [], finalParams: bodyCtx }
        }
        const subFlow = buildSubFlow(flowSteps, loopBodySteps)
        return run(subFlow, bodyCtx)
      }

      const pushIterationSubSteps = (iterationIndex: number, runResult: RunResult) => {
        const prefix = `iteration_${iterationIndex + 1}`
        subSteps.push({ stepId: prefix, success: true })
        for (const s of runResult.steps)
          subSteps.push({ ...s, stepId: `${prefix}.${s.stepId}` })
      }

      const checkIterationCompleteSignal = (runResult: RunResult): boolean => {
        if (iterationCompleteSignals.length === 0) {
          return true // If no signal required, iteration is always "complete"
        }
        for (const s of runResult.steps) {
          if (s.success && iterationCompleteSignals.includes(s.stepId)) {
            return true
          }
        }
        return false
      }

      // --- Unified Driver ---
      let loopCount = 0
      const items = Array.isArray(step.items) ? step.items : null
      const countNum = parseCount(step.count)

      if (items !== null) {
        loopCount = items.length
      }
      else if (countNum !== null) {
        loopCount = countNum
      }
      else {
        return {
          success: false,
          error: 'loop step requires one of: items, or count',
        }
      }

      for (let index = 0; index < loopCount; index++) {
        let bodyCtx: Record<string, unknown> = { ...ctx, index }
        if (items !== null) {
          bodyCtx = { ...bodyCtx, item: items[index], items }
        }
        else {
          bodyCtx = { ...bodyCtx, count: loopCount }
        }

        const out = await runBody(bodyCtx)
        pushIterationSubSteps(index, out)

        if (out.nextSteps === null) {
          return {
            success: out.success,
            error: out.error,
            outputs: out.finalParams ?? ctx,
            nextSteps: null,
            subSteps,
          }
        }

        ctx = out.finalParams ?? ctx
        if (!out.success)
          stepSuccess = false

        if (!checkIterationCompleteSignal(out)) {
          return {
            success: stepSuccess,
            outputs: { ...ctx, count: iterationCount + 1, items: items ? [...items] : undefined },
            subSteps,
            nextSteps: null,
            log: `loop terminated early after ${iterationCount + 1} iteration(s) (no completion signal reached)`,
          }
        }
        iterationCount++
      }

      const finalOutputs = { ...ctx, count: iterationCount, items: items ? [...items] : undefined }
      if (items === null)
        delete finalOutputs.items

      let nextSteps: string[] | null | undefined = null
      if (stepSuccess) {
        nextSteps = doneIds.length > 0 ? doneIds : undefined
      }

      return {
        success: stepSuccess,
        outputs: finalOutputs,
        nextSteps,
        subSteps,
        log: `done, ${iterationCount} iteration(s)`,
      }
    },
  })
}

export default loopHandler
