/**
 * Execution engine: DAG execution only. run(flow, options) runs one flow; context.run runs nested flows.
 * Optional scopeStepIds for early exit when nextSteps leaves scope (e.g. loop body). No file I/O.
 */
import type { FlowDefinition, FlowStep, IStepHandler, RunOptions, RunResult, StepContext, StepRegistry, StepResult, StepResultFn, StepResultOptions } from './types'
import { topologicalSort } from './dag'
import { evaluateToBoolean } from './safeExpression'
import { substituteStep } from './substitute'
import { buildStepByIdMap, getEffectiveOutputKey, isPlainObject, mergeBatchResultsIntoContext } from './utils'

/** Build a StepResult with consistent shape; used as context.stepResult and internally. */
export function stepResult(
  stepId: string,
  success: boolean,
  opts: StepResultOptions = {},
): StepResult {
  const out: StepResult = {
    stepId,
    success,
  }
  if (opts.error !== undefined)
    out.error = opts.error
  if (opts.outputs !== undefined)
    out.outputs = opts.outputs
  if (opts.log !== undefined)
    out.log = opts.log
  if (opts.nextSteps !== undefined)
    out.nextSteps = opts.nextSteps
  if (opts.completedStepIds !== undefined)
    out.completedStepIds = opts.completedStepIds
  if (opts.subSteps !== undefined)
    out.subSteps = opts.subSteps
  return out
}

const DEFAULT_MAX_FLOW_CALL_DEPTH = 8
const DEFAULT_STEP_TIMEOUT_SEC = 60

function evaluateSkip(step: FlowStep, context: Record<string, unknown>): boolean {
  const skip = step.skip
  if (skip === undefined || skip === null)
    return false
  if (typeof skip !== 'string')
    return false
  try {
    return evaluateToBoolean(skip, context, { maxLength: 2000 })
  }
  catch {
    return false
  }
}

async function runWithTimeout(
  step: FlowStep,
  handler: IStepHandler,
  runFn: () => Promise<StepResult>,
  defaultTimeoutSec: number = DEFAULT_STEP_TIMEOUT_SEC,
): Promise<StepResult> {
  const timeoutSec = typeof step.timeout === 'number' && step.timeout > 0
    ? step.timeout
    : defaultTimeoutSec
  const timeoutMs = timeoutSec * 1000
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<StepResult>((_, reject) => {
    timeoutId = setTimeout(() => {
      handler.kill?.()
      reject(new Error(`step timeout after ${timeoutSec}s`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([runFn(), timeoutPromise])
  }
  finally {
    if (timeoutId !== undefined)
      clearTimeout(timeoutId)
  }
}

function allowedByNextSteps(
  stepId: string,
  step: FlowStep,
  stepNextSteps: Record<string, string[]>,
): boolean {
  const deps = step.dependsOn
  if (!Array.isArray(deps))
    return true
  for (const dep of deps) {
    const next = stepNextSteps[dep]
    if (next !== undefined && !next.includes(stepId))
      return false
  }
  return true
}

function getRunnable(
  dagOrder: string[],
  completed: Set<string>,
  stepByIdMap: Map<string, FlowStep>,
  stepNextSteps: Record<string, string[]>,
): string[] {
  const runnable: string[] = []
  for (const stepId of dagOrder) {
    if (completed.has(stepId))
      continue
    const step = stepByIdMap.get(stepId)
    if (!step)
      continue
    const deps = Array.isArray(step.dependsOn) ? step.dependsOn : []
    let depsSatisfied = true
    for (const dep of deps) {
      if (!completed.has(dep)) {
        depsSatisfied = false
        break
      }
    }
    if (!depsSatisfied)
      continue
    if (!allowedByNextSteps(stepId, step, stepNextSteps))
      continue
    runnable.push(stepId)
  }
  return runnable
}

interface ExecuteStepOnceDeps {
  stepByIdMap: Map<string, FlowStep>
  registry: StepRegistry
  stepResult: StepResultFn
  runWithTimeout: (step: FlowStep, handler: IStepHandler, fn: () => Promise<StepResult>) => Promise<StepResult>
  buildStepContext: (ctx: Record<string, unknown>) => StepContext
}

async function executeStepOnce(
  stepId: string,
  ctx: Record<string, unknown>,
  deps: ExecuteStepOnceDeps,
): Promise<{ result: StepResult }> {
  const { stepByIdMap, registry, stepResult, runWithTimeout, buildStepContext } = deps
  const step = stepByIdMap.get(stepId)
  if (!step) {
    return { result: stepResult(stepId, false, { error: `Step not found: ${stepId}` }) }
  }
  const sub = substituteStep(step, { ...ctx, params: ctx })
  const ent = registry[step.type]
  if (!ent) {
    return { result: stepResult(stepId, false, { error: `Unknown step type: ${step.type}` }) }
  }
  const valid = ent.validate?.(sub)
  if (valid !== undefined && valid !== true) {
    return { result: stepResult(stepId, false, { error: valid }) }
  }
  if (evaluateSkip(sub, ctx)) {
    return { result: stepResult(stepId, true) }
  }
  const stepCtx = buildStepContext(ctx)
  try {
    const res = await runWithTimeout(sub, ent, () => ent.run(sub, stepCtx))
    return { result: res ?? stepResult(stepId, false, { error: 'Handler returned no result' }) }
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { result: stepResult(stepId, false, { error: message }) }
  }
}

export type RunFn = (flow: FlowDefinition, options: RunOptions) => Promise<RunResult>

/**
 * Execute a single flow: DAG main loop, context.run for nested flows. Optional scopeStepIds for early exit.
 */
export async function executeFlow(
  flow: FlowDefinition,
  options: RunOptions,
  initialParams: Record<string, unknown>,
  runFn: RunFn,
): Promise<RunResult> {
  const steps: StepResult[] = []
  const sortResult = topologicalSort(flow.steps)
  if (!sortResult.ok) {
    return { success: false, steps: [], error: sortResult.error }
  }
  const dagOrder = sortResult.order
  const registry = options.registry ?? ({} as StepRegistry)
  const stepByIdMap = buildStepByIdMap(flow)
  const flowCallDepth = options.flowCallDepth ?? 0
  const maxFlowCallDepth = options.maxFlowCallDepth ?? DEFAULT_MAX_FLOW_CALL_DEPTH
  const defaultStepTimeoutSec = options.defaultStepTimeoutSec ?? DEFAULT_STEP_TIMEOUT_SEC
  const runWithTimeoutBound = (step: FlowStep, handler: IStepHandler, fn: () => Promise<StepResult>) =>
    runWithTimeout(step, handler, fn, defaultStepTimeoutSec)

  const run: StepContext['run'] = async (
    childFlow: FlowDefinition,
    params: Record<string, unknown>,
    runOptions?: { scopeStepIds?: string[] },
  ): Promise<RunResult> => {
    if (flowCallDepth >= maxFlowCallDepth)
      return { success: false, steps: [], error: 'max flow-call depth exceeded' }
    return runFn(childFlow, {
      ...options,
      params,
      flowCallDepth: flowCallDepth + 1,
      maxFlowCallDepth,
      registry,
      scopeStepIds: runOptions?.scopeStepIds,
    })
  }

  if (options.dryRun) {
    // Dry run: validate each step (substitute, handler lookup, validate) without executing run().
    let drySuccess = true
    for (const stepId of dagOrder) {
      const step = stepByIdMap.get(stepId)
      if (!step) {
        steps.push(stepResult(stepId, false, { error: `Step not found: ${stepId}` }))
        drySuccess = false
        continue
      }
      const sub = substituteStep(step, { ...initialParams, params: initialParams })
      const ent = registry[step.type]
      if (!ent) {
        steps.push(stepResult(stepId, false, { error: `Unknown step type: ${step.type}` }))
        drySuccess = false
        continue
      }
      const valid = ent.validate?.(sub)
      if (valid !== undefined && valid !== true) {
        steps.push(stepResult(stepId, false, { error: valid }))
        drySuccess = false
        continue
      }
      steps.push(stepResult(stepId, true))
    }
    return { success: drySuccess, steps }
  }

  let context: Record<string, unknown> = { ...initialParams }
  const completed = new Set<string>()
  const stepNextSteps: Record<string, string[]> = {}

  const stepContext: StepContext = {
    params: context,
    stepResult,
    run,
    flowMap: options.flowMap,
    steps: flow.steps,
  }

  let success = true
  const runOneStepInWave = async (
    stepId: string,
    ctx: Record<string, unknown>,
  ): Promise<{ result: StepResult, outputs?: Record<string, unknown>, nextSteps?: string[] }> => {
    const accumulatedLog: string[] = []
    const buildStepContext = (c: Record<string, unknown>): StepContext => ({
      ...stepContext,
      params: c,
      appendLog: (msg: string) => { accumulatedLog.push(msg) },
    })
    const onceDeps: ExecuteStepOnceDeps = {
      stepByIdMap,
      registry,
      stepResult,
      runWithTimeout: runWithTimeoutBound,
      buildStepContext,
    }
    const step = stepByIdMap.get(stepId)
    if (step)
      options.onStepStart?.(stepId, step)
    const { result } = await executeStepOnce(stepId, ctx, onceDeps)
    options.onStepComplete?.(stepId, result)
    const resultWithLog = accumulatedLog.length > 0
      ? { ...result, log: [...accumulatedLog, result.log].filter(Boolean).join('\n') }
      : result
    return {
      result: resultWithLog,
      outputs: resultWithLog.outputs && isPlainObject(resultWithLog.outputs) ? resultWithLog.outputs : undefined,
      nextSteps: resultWithLog.nextSteps,
    }
  }

  while (true) {
    const runnable = getRunnable(dagOrder, completed, stepByIdMap, stepNextSteps)
    if (runnable.length === 0)
      break
    const batchResults = await Promise.all(runnable.map(stepId => runOneStepInWave(stepId, context)))
    for (const { result, outputs, nextSteps } of batchResults) {
      steps.push(result)
      if (result.subSteps?.length) {
        for (const s of result.subSteps)
          steps.push({ ...s, stepId: `${result.stepId}.${s.stepId}` })
      }
      completed.add(result.stepId)
      if (result.completedStepIds && Array.isArray(result.completedStepIds)) {
        for (const id of result.completedStepIds)
          completed.add(id)
      }
      if (nextSteps !== undefined && Array.isArray(nextSteps))
        stepNextSteps[result.stepId] = nextSteps
      const scopeStepIds = options.scopeStepIds
      if (scopeStepIds?.length && nextSteps?.some(id => !scopeStepIds.includes(id))) {
        const finalContext = mergeBatchResultsIntoContext(
          batchResults.map(b => ({ result: b.result })),
          stepByIdMap,
          context,
        )
        return {
          success,
          steps,
          earlyExit: { nextSteps: nextSteps! },
          finalParams: finalContext,
        }
      }
      const out = outputs && isPlainObject(outputs) ? outputs : {}
      const effectiveKey = getEffectiveOutputKey(stepByIdMap.get(result.stepId), result.stepId)
      context = { ...context, [effectiveKey]: out }
      if (!result.success)
        success = false
    }
    stepContext.params = context
  }

  return {
    success,
    steps,
    finalParams: context,
  }
}
