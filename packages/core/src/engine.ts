import type { SimpleResult } from './handler-factory'
/**
 * Execution engine: DAG execution only. run(flow, options) runs one flow; context.run runs nested flows.
 * No file I/O.
 */
import type { FlowDefinition, FlowStep, RunOptions, RunResult, StepContext, StepRegistry, StepResult, StepResultFn, StepResultOptions } from './types'
import { topologicalSort } from './dag'
import { evaluateToBoolean } from './safeExpression'
import { substituteStep } from './substitute'
import { buildStepByIdMap, getEffectiveOutputKey, isPlainObject } from './utils'

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
  runFn: () => Promise<StepResult>,
  defaultTimeoutSec: number = DEFAULT_STEP_TIMEOUT_SEC,
  signal: AbortSignal,
): Promise<StepResult> {
  try {
    return await runFn()
  }
  catch (e) {
    if (signal.aborted && e instanceof Error && (e.name === 'AbortError' || e.message === 'step aborted')) {
      throw new Error(`step timeout after ${typeof step.timeout === 'number' && step.timeout > 0 ? step.timeout : defaultTimeoutSec}s`)
    }
    throw e
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

interface RunStepDeps {
  stepByIdMap: Map<string, FlowStep>
  registry: StepRegistry
  stepResult: StepResultFn
  runWithTimeout: (step: FlowStep, fn: () => Promise<StepResult>, defaultTimeoutSec?: number, signal?: AbortSignal) => Promise<StepResult>
  buildStepContext: (ctx: Record<string, unknown>) => StepContext
  defaultStepTimeoutSec: number
  dryRun?: boolean
}

async function runStep(
  stepId: string,
  ctx: Record<string, unknown>,
  deps: RunStepDeps,
  parentSignal?: AbortSignal,
): Promise<{ result: StepResult }> {
  const { stepByIdMap, registry, stepResult, runWithTimeout, buildStepContext, dryRun, defaultStepTimeoutSec } = deps
  const step = stepByIdMap.get(stepId)
  if (!step) {
    return { result: stepResult(stepId, false, { error: `Step not found: ${stepId}`, nextSteps: null }) }
  }
  const sub = substituteStep(step, { ...ctx, params: ctx })
  const config = registry[step.type]
  if (!config) {
    return { result: stepResult(stepId, false, { error: `Unknown step type: ${step.type}`, nextSteps: null }) }
  }

  if (config.schema) {
    const parsed = config.schema.safeParse(sub)
    if (!parsed.success) {
      return { result: stepResult(stepId, false, { error: parsed.error.message, nextSteps: null }) }
    }
  }

  if (dryRun) {
    return { result: stepResult(stepId, true) }
  }
  if (evaluateSkip(sub, ctx)) {
    return { result: stepResult(stepId, true) }
  }

  // Create AbortController for this step execution
  const abortController = new AbortController()
  const signal = abortController.signal

  // Abort if parent signal aborts
  if (parentSignal) {
    if (parentSignal.aborted) {
      abortController.abort()
    }
    else {
      parentSignal.addEventListener('abort', () => abortController.abort(), { once: true })
    }
  }

  // Set timeout to abort signal
  const timeoutSec = typeof sub.timeout === 'number' && sub.timeout > 0
    ? sub.timeout
    : defaultStepTimeoutSec
  const timeoutMs = timeoutSec * 1000
  const timeoutId = setTimeout(() => {
    abortController.abort()
  }, timeoutMs)

  const stepCtx = buildStepContext(ctx)
  stepCtx.signal = signal

  let lastResult: SimpleResult | undefined
  const report = (res: SimpleResult) => {
    if (!lastResult) {
      lastResult = { ...res }
    }
    else {
      lastResult = {
        ...lastResult,
        ...res,
        outputs: (lastResult.outputs || res.outputs)
          ? { ...(lastResult.outputs || {}), ...(res.outputs || {}) }
          : undefined,
        subSteps: (lastResult.subSteps || res.subSteps)
          ? [...(lastResult.subSteps || []), ...(res.subSteps || [])]
          : undefined,
      }
    }
  }

  const runHandler = async (): Promise<StepResult> => {
    const handlerCtx = {
      step: sub,
      params: ctx,
      report,
      signal,
      run: stepCtx.run,
      steps: stepCtx.steps,
      flowMap: stepCtx.flowMap,
    }
    const result = await config.run(handlerCtx)
    if (result) {
      report(result)
    }
    if (!lastResult) {
      return stepResult(stepId, false, { error: 'Handler returned no result' })
    }
    return stepResult(stepId, lastResult.success, lastResult)
  }

  try {
    const res = await runWithTimeout(sub, runHandler, defaultStepTimeoutSec, signal)
    return { result: res }
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { result: stepResult(stepId, false, { error: message }) }
  }
  finally {
    clearTimeout(timeoutId)
  }
}

export type RunFn = (flow: FlowDefinition, options: RunOptions) => Promise<RunResult>

/**
 * Execute a single flow: DAG main loop, context.run for nested flows.
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
  const runWithTimeoutBound = (step: FlowStep, fn: () => Promise<StepResult>, defaultTimeout?: number, signal?: AbortSignal) =>
    runWithTimeout(step, fn, defaultTimeout ?? defaultStepTimeoutSec, signal!)

  const run: StepContext['run'] = async (
    childFlow: FlowDefinition,
    params: Record<string, unknown>,
  ): Promise<RunResult> => {
    if (flowCallDepth >= maxFlowCallDepth)
      return { success: false, steps: [], error: 'max flow-call depth exceeded' }
    return runFn(childFlow, {
      ...options,
      params,
      flowCallDepth: flowCallDepth + 1,
      maxFlowCallDepth,
      registry,
    })
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

  const buildStepContext = (c: Record<string, unknown>): StepContext => ({
    ...stepContext,
    params: c,
  })

  if (options.dryRun) {
    // Dry run: validate each step (substitute, handler lookup, validate) without executing run().
    const runStepDeps: RunStepDeps = {
      stepByIdMap,
      registry,
      stepResult,
      runWithTimeout: runWithTimeoutBound,
      buildStepContext,
      defaultStepTimeoutSec,
      dryRun: true,
    }
    let drySuccess = true
    for (const stepId of dagOrder) {
      const { result } = await runStep(stepId, initialParams, runStepDeps)
      steps.push(result)
      if (!result.success)
        drySuccess = false
    }
    return { success: drySuccess, steps }
  }

  let success = true
  const flowAbortController = new AbortController()

  const runOneStepInWave = async (
    stepId: string,
    ctx: Record<string, unknown>,
  ): Promise<{ result: StepResult, outputs?: Record<string, unknown>, nextSteps?: string[] | null, flowTerminated?: boolean }> => {
    const runStepDeps: RunStepDeps = {
      stepByIdMap,
      registry,
      stepResult,
      runWithTimeout: runWithTimeoutBound,
      buildStepContext,
      defaultStepTimeoutSec,
    }
    const step = stepByIdMap.get(stepId)
    if (step)
      options.onStepStart?.(stepId, step)
    const { result } = await runStep(stepId, ctx, runStepDeps, flowAbortController.signal)
    options.onStepComplete?.(stepId, result)

    if (result.nextSteps === null) {
      return {
        result,
        flowTerminated: true,
      }
    }

    return {
      result,
      outputs: result.outputs && isPlainObject(result.outputs) ? result.outputs : undefined,
      nextSteps: result.nextSteps,
    }
  }

  while (true) {
    const runnable = getRunnable(dagOrder, completed, stepByIdMap, stepNextSteps)
    if (runnable.length === 0)
      break
    const batchResults = await Promise.all(runnable.map(stepId => runOneStepInWave(stepId, context)))
    let shouldAbort = false
    for (const { result, outputs, nextSteps, flowTerminated } of batchResults) {
      steps.push(result)
      if (result.subSteps?.length) {
        for (const s of result.subSteps)
          steps.push({ ...s, stepId: `${result.stepId}.${s.stepId}` })
      }

      if (flowTerminated) {
        // A step returned nextSteps: null, so terminate the entire flow.
        flowAbortController.abort()
        return {
          success: result.success, // Use the last step's success for the flow result
          steps,
          finalParams: context,
          error: result.error, // Propagate error if the terminating step had one
        }
      }
      completed.add(result.stepId)
      if (result.completedStepIds && Array.isArray(result.completedStepIds)) {
        for (const id of result.completedStepIds)
          completed.add(id)
      }
      if (nextSteps !== undefined && nextSteps !== null && Array.isArray(nextSteps)) {
        stepNextSteps[result.stepId] = nextSteps
      }
      const out = outputs && isPlainObject(outputs) ? outputs : {}
      const effectiveKey = getEffectiveOutputKey(stepByIdMap.get(result.stepId), result.stepId)
      context = { ...context, [effectiveKey]: out }
      if (!result.success) {
        success = false
        const step = stepByIdMap.get(result.stepId)
        const stepContinue = step?.continueOnError
        const globalContinue = options.continueOnError ?? false
        const shouldContinue = stepContinue !== undefined ? stepContinue : globalContinue
        if (!shouldContinue)
          shouldAbort = true
      }
    }
    if (shouldAbort) {
      flowAbortController.abort()
      break
    }
    stepContext.params = context
  }

  const runResult: RunResult = {
    success,
    steps,
    finalParams: context,
  }
  if (!success && !runResult.error) {
    runResult.error = steps.find(s => !s.success)?.error
  }

  return runResult
}
