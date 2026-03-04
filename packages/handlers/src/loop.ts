// @env node
import type { FactoryContext, FlowDefinition, FlowStep, RunResult } from '@runflow/core'

/**
 * Compute the forward transitive closure from entry step ids for a loop.
 * Scope starts with entryIds; repeatedly add step S if every id in S.dependsOn
 * is either loopStepId or already in scope. Only steps present in `steps` are added.
 */
export function computeLoopClosure(
  steps: FlowStep[],
  entryIds: string[],
  loopStepId: string,
): string[] {
  const stepById = new Map(steps.map(s => [s.id, s]))
  const scope = new Set<string>(entryIds.filter(id => stepById.has(id)))

  let changed = true
  while (changed) {
    changed = false
    for (const step of steps) {
      if (scope.has(step.id))
        continue
      const deps = step.dependsOn
      if (!Array.isArray(deps) || deps.length === 0)
        continue
      const allInScope = deps.every(dep => dep === loopStepId || scope.has(dep))
      if (allInScope) {
        scope.add(step.id)
        changed = true
      }
    }
  }

  return [...scope]
}

/**
 * Compute backward closure: all step ids that are transitive dependencies of targetIds
 * (steps that must run before any of targetIds). Used with connect to define "one round".
 */
export function computeBackwardClosure(
  steps: FlowStep[],
  targetIds: string[],
): Set<string> {
  const stepById = new Map(steps.map(s => [s.id, s]))
  const scope = new Set(targetIds.filter(id => stepById.has(id)))
  let changed = true
  while (changed) {
    changed = false
    for (const id of scope) {
      const st = stepById.get(id)
      if (!st || !Array.isArray(st.dependsOn))
        continue
      for (const dep of st.dependsOn) {
        if (!scope.has(dep)) {
          scope.add(dep)
          changed = true
        }
      }
    }
  }
  return scope
}

/**
 * Return step ids that must be excluded from the loop body: done ids plus any step in closure
 * that (transitively) depends on a done step. Those run only after the loop returns nextSteps.
 */
export function closureIdsThatDependOnDone(
  steps: FlowStep[],
  closureIds: string[],
  doneIds: string[],
): Set<string> {
  const stepById = new Map(steps.map(s => [s.id, s]))
  const excluded = new Set(doneIds)
  let changed = true
  while (changed) {
    changed = false
    for (const id of closureIds) {
      if (excluded.has(id))
        continue
      const st = stepById.get(id)
      if (!st || !Array.isArray(st.dependsOn))
        continue
      if (st.dependsOn.some(dep => excluded.has(dep))) {
        excluded.add(id)
        changed = true
      }
    }
  }
  return excluded
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
    schema: z.object({
      items: z.array(z.unknown()).optional(),
      count: z.union([z.number().nonnegative(), z.string()]).optional(),
      entry: z.union([
        z.string().min(1),
        z.array(z.string()).min(1),
      ]),
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
    ).refine(
      (data) => {
        const entryIds = utils.normalizeStepIds(data.entry)
        return entryIds.length > 0
      },
      {
        message: 'loop step requires entry (non-empty step id or array of ids)',
      },
    ),
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
      if (entryIds.length === 0) {
        return {
          success: false,
          error: 'loop step requires entry (non-empty step id or array of ids)',
        }
      }

      // Validate body step ids exist in context.steps before building sub-flow
      const stepById = new Map(flowSteps.map(s => [s.id, s]))
      const missingIds: string[] = []
      for (const eid of entryIds) {
        if (!stepById.has(eid)) {
          missingIds.push(eid)
        }
      }
      if (missingIds.length > 0) {
        return {
          success: false,
          error: `loop entry id(s) not found in flow steps: ${missingIds.join(', ')}`,
        }
      }

      const closureIds = computeLoopClosure(flowSteps, entryIds, step.id)
      const doneIds = utils.normalizeStepIds(step.done)

      const excludedFromBody = closureIdsThatDependOnDone(flowSteps, closureIds, doneIds)
      const loopBodySteps = closureIds.filter(id => !excludedFromBody.has(id))

      if (loopBodySteps.length === 0) {
        return {
          success: false,
          error: 'loop closure is empty (or only done steps); ensure entry ids exist and are not all in done',
        }
      }

      const closureSet = new Set(closureIds)
      for (const eid of entryIds) {
        if (!closureSet.has(eid)) {
          return {
            success: false,
            error: `loop entry id "${eid}" is not in the computed closure; ensure it exists in the flow`,
          }
        }
      }

      const iterationCompleteSignals = Array.isArray(step.iterationCompleteSignals) ? step.iterationCompleteSignals : []

      let ctx: Record<string, unknown> = { ...context.params }
      let stepSuccess = true
      let iterationCount = 0
      const subSteps: RunResult['steps'] = []

      const runBody = async (bodyCtx: Record<string, unknown>): Promise<RunResult> => {
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
          return false
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
      const items = Array.isArray(step.items) ? (step.items as unknown[]) : null
      const countNum = parseCount(step.count)

      if (items !== null) {
        loopCount = items.length
      }
      else if (countNum !== null) {
        loopCount = countNum
      }
      else {
        // Should be caught by schema validation, but for safety:
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

      const finalOutputs = { ...ctx, count: iterationCount }
      if (items !== null)
        (finalOutputs as any).items = [...items]

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
