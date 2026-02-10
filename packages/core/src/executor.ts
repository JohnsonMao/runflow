// @env node
import type { FlowDefinition, FlowStep, IStepHandler, RunOptions, RunResult, RunSubFlowFn, StepContext, StepRegistry, StepResult } from './types'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { topologicalSort, validateDAG } from './dag'
import { loadFromFile } from './loader'
import { paramsDeclarationToZodSchema } from './paramsSchema'
import { evaluateToBoolean } from './safeExpression'
import { stepResult } from './stepResult'
import { substitute } from './substitute'
import { isPlainObject } from './utils'

/** Default maximum flow-call nesting depth. When a flow step would run the callee at this depth, the step fails with depth-exceeded error. */
export const DEFAULT_MAX_FLOW_CALL_DEPTH = 32

/** Evaluate step-level skip using safe expression. Returns true to skip step, false to run. Default (skip absent) is false. */
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

/** Default step timeout in seconds when step.timeout is not set. */
const DEFAULT_STEP_TIMEOUT_SEC = 60

/** Run handler with step-level timeout; on timeout calls handler.kill() then fails. */
async function runWithTimeout(
  step: FlowStep,
  handler: IStepHandler,
  runFn: () => Promise<StepResult>,
): Promise<StepResult> {
  const timeoutSec = typeof step.timeout === 'number' && step.timeout > 0
    ? step.timeout
    : DEFAULT_STEP_TIMEOUT_SEC
  const timeoutMs = timeoutSec * 1000
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<StepResult>((_, reject) => {
    timeoutId = setTimeout(() => {
      handler.kill()
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

/** Substitute all string values in step (and nested objects) using context. Executor calls this before invoking the handler. */
function substituteValue(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string')
    return substitute(value, context)
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value))
      out[k] = substituteValue(v, context)
    return out
  }
  if (Array.isArray(value))
    return value.map(item => substituteValue(item, context))
  return value
}

function substituteStep(step: FlowStep, context: Record<string, unknown>): FlowStep {
  const out: FlowStep = { id: step.id, type: step.type }
  for (const [k, v] of Object.entries(step)) {
    if (k === 'id' || k === 'type')
      continue
    out[k] = substituteValue(v, context)
  }
  return out
}

function stepById(flow: FlowDefinition): Map<string, FlowStep> {
  const m = new Map<string, FlowStep>()
  for (const s of flow.steps)
    m.set(s.id, s)
  return m
}

/**
 * Step is runnable when all deps completed and, for each dep that returned nextSteps,
 * this step id must be in that dep's nextSteps. If a dep did not return nextSteps, all its dependents stay allowed.
 */
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
    if (!step || step.dependsOn == null || !Array.isArray(step.dependsOn))
      continue
    let depsSatisfied = true
    for (const dep of step.dependsOn) {
      if (!completed.has(dep)) {
        depsSatisfied = false
        break
      }
    }
    if (!depsSatisfied)
      continue
    let allowedByDeps = true
    for (const dep of step.dependsOn) {
      const nextSteps = stepNextSteps[dep]
      if (nextSteps === undefined)
        continue
      if (!nextSteps.includes(stepId)) {
        allowedByDeps = false
        break
      }
    }
    if (allowedByDeps)
      runnable.push(stepId)
  }
  return runnable
}

export async function run(flow: FlowDefinition, options: RunOptions = {}): Promise<RunResult> {
  const steps: StepResult[] = []
  let initialParams: Record<string, unknown> = { ...(options.params ?? {}) }

  if (flow.params && flow.params.length > 0) {
    const schema = paramsDeclarationToZodSchema(flow.params)
    const parsed = schema.safeParse(options.params ?? {})
    if (!parsed.success) {
      const msg = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      return {
        flowName: flow.name,
        success: false,
        steps: [],
        error: msg,
      }
    }
    initialParams = parsed.data
  }

  const dagError = validateDAG(flow.steps)
  if (dagError) {
    return {
      flowName: flow.name,
      success: false,
      steps: [],
      error: dagError,
    }
  }

  const sortResult = topologicalSort(flow.steps)
  if (!sortResult.ok) {
    return {
      flowName: flow.name,
      success: false,
      steps: [],
      error: sortResult.error,
    }
  }

  const dagOrder = sortResult.order
  if (dagOrder.length > 0 && (options.registry == null || typeof options.registry !== 'object'))
    throw new Error('registry is required when flow has steps')
  const registry = options.registry ?? ({} as StepRegistry)
  const stepByIdMap = stepById(flow)
  const flowCallDepth = options.flowCallDepth ?? 0
  const maxFlowCallDepth = options.maxFlowCallDepth ?? DEFAULT_MAX_FLOW_CALL_DEPTH

  const runFlow = async (filePath: string, params: Record<string, unknown>): Promise<RunResult> => {
    const baseDir = options.flowFilePath ? resolve(dirname(options.flowFilePath)) : resolve(process.cwd())
    const resolvedPath = isAbsolute(filePath) ? resolve(filePath) : resolve(baseDir, filePath)
    const rel = relative(baseDir, resolvedPath)
    if (rel.startsWith('..') || rel === '..')
      return { flowName: flow.name, success: false, steps: [], error: 'flow path must be under current flow directory' }
    if (flowCallDepth >= maxFlowCallDepth)
      return { flowName: flow.name, success: false, steps: [], error: 'max flow-call depth exceeded' }
    const loaded = loadFromFile(resolvedPath)
    if (!loaded)
      return { flowName: filePath, success: false, steps: [], error: 'flow not found or failed to load' }
    return run(loaded, {
      params,
      flowFilePath: resolvedPath,
      flowCallDepth: flowCallDepth + 1,
      maxFlowCallDepth,
      registry,
    })
  }

  if (options.dryRun) {
    for (const stepId of dagOrder)
      steps.push(stepResult(stepId, true))
    return {
      flowName: flow.name,
      success: true,
      steps,
    }
  }

  let context: Record<string, unknown> = { ...initialParams }
  let success = true
  const completed = new Set<string>()
  const stepNextSteps: Record<string, string[]> = {}

  let stepContext: StepContext

  /** Run a single step by id with given context; returns result and new context. Used by runSubFlow. */
  const runStepById = async (targetStepId: string, ctx: Record<string, unknown>): Promise<{ result: StepResult, newContext: Record<string, unknown> }> => {
    const st = stepByIdMap.get(targetStepId)
    if (!st) {
      return {
        result: stepResult(targetStepId, false, { error: `Step not found: ${targetStepId}` }),
        newContext: ctx,
      }
    }
    const sub = substituteStep(st, ctx)
    const ent = registry[st.type]
    if (!ent) {
      return {
        result: stepResult(targetStepId, false, { error: `Unknown step type: ${st.type}` }),
        newContext: ctx,
      }
    }
    const valid = ent.validate(sub)
    if (valid !== true) {
      return {
        result: stepResult(targetStepId, false, { error: valid }),
        newContext: ctx,
      }
    }
    if (evaluateSkip(sub, ctx)) {
      return {
        result: stepResult(targetStepId, true),
        newContext: ctx,
      }
    }
    const tempStepContext: StepContext = {
      params: ctx,
      flowFilePath: options.flowFilePath,
      runSubFlow: stepContext.runSubFlow,
      stepResult,
      runFlow: stepContext.runFlow,
    }
    try {
      const res = await runWithTimeout(sub, ent, () => ent.run(sub, tempStepContext))
      const result = res ?? stepResult(targetStepId, false, { error: 'Handler returned no result' })
      const newContext = result.outputs && isPlainObject(result.outputs) ? { ...ctx, ...result.outputs } : ctx
      return { result, newContext }
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        result: stepResult(targetStepId, false, { error: message }),
        newContext: ctx,
      }
    }
  }

  /** Run body steps as sub-flow (DAG order, skip/condition/nextSteps). Returns earlyExit when a step returns nextSteps outside body. */
  const runSubFlow: RunSubFlowFn = async (
    bodyStepIds: string[],
    ctx: Record<string, unknown>,
  ) => {
    const scopeSet = new Set(bodyStepIds)
    const subCompleted = new Set<string>()
    for (const id of stepByIdMap.keys()) {
      if (!scopeSet.has(id))
        subCompleted.add(id)
    }
    const subNextSteps: Record<string, string[]> = {}
    const results: StepResult[] = []
    let currentCtx = ctx
    while (true) {
      const runnable = getRunnable(dagOrder, subCompleted, stepByIdMap, subNextSteps).filter(id => scopeSet.has(id))
      if (runnable.length === 0)
        break
      const batch = await Promise.all(runnable.map(stepId => runStepById(stepId, currentCtx)))
      for (const { result } of batch) {
        results.push(result)
        steps.push(result)
        if (result.nextSteps !== undefined && Array.isArray(result.nextSteps) && result.nextSteps.some(id => !scopeSet.has(id))) {
          const mergedCtx = batch.reduce<Record<string, unknown>>((acc, { result: r }) => {
            return r.outputs && isPlainObject(r.outputs) ? { ...acc, ...r.outputs } : acc
          }, { ...currentCtx })
          return {
            results,
            newContext: mergedCtx,
            earlyExit: { nextSteps: result.nextSteps },
          }
        }
        subCompleted.add(result.stepId)
        if (result.nextSteps !== undefined && Array.isArray(result.nextSteps))
          subNextSteps[result.stepId] = result.nextSteps
      }
      currentCtx = batch.reduce<Record<string, unknown>>((acc, { result: r }) => {
        return r.outputs && isPlainObject(r.outputs) ? { ...acc, ...r.outputs } : acc
      }, { ...currentCtx })
    }
    return { results, newContext: currentCtx }
  }

  stepContext = {
    params: context,
    flowFilePath: options.flowFilePath,
    runSubFlow,
    stepResult,
    runFlow,
    allowedHttpHosts: options.allowedHttpHosts,
  }

  /** Run a single step in the current wave (same context). Used to run all runnable steps in parallel. */
  const runOneStepInWave = async (
    stepId: string,
    ctx: Record<string, unknown>,
  ): Promise<{ result: StepResult, outputs?: Record<string, unknown>, nextSteps?: string[] }> => {
    const step = stepByIdMap.get(stepId)!
    const substitutedStep = substituteStep(step, ctx)
    const entry = registry[step.type]
    if (!entry) {
      return {
        result: stepResult(stepId, false, { error: `Unknown step type: ${step.type}` }),
      }
    }
    const valid = entry.validate(substitutedStep)
    if (valid !== true) {
      return {
        result: stepResult(stepId, false, { error: valid }),
      }
    }
    if (evaluateSkip(substitutedStep, ctx)) {
      return { result: stepResult(stepId, true) }
    }
    try {
      const stepContextForRun: StepContext = { ...stepContext, params: ctx }
      const maxAttempts = Math.max(1, (Number(substitutedStep.retry) ?? 0) + 1)
      const runOne = (): Promise<StepResult> =>
        runWithTimeout(substitutedStep, entry, () => entry.run(substitutedStep, stepContextForRun))
      let toPush: StepResult = await runOne() ?? stepResult(stepId, false, { error: 'Handler returned no result' })
      for (let attempt = 1; attempt < maxAttempts && !toPush.success; attempt++)
        toPush = await runOne() ?? toPush
      return {
        result: toPush,
        outputs: toPush.outputs && isPlainObject(toPush.outputs) ? toPush.outputs : undefined,
        nextSteps: toPush.nextSteps,
      }
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { result: stepResult(stepId, false, { error: message }) }
    }
  }

  while (true) {
    const runnable = getRunnable(dagOrder, completed, stepByIdMap, stepNextSteps)
    if (runnable.length === 0)
      break
    const batchResults = await Promise.all(runnable.map(stepId => runOneStepInWave(stepId, context)))
    for (const { result, outputs, nextSteps } of batchResults) {
      steps.push(result)
      completed.add(result.stepId)
      if (nextSteps !== undefined && Array.isArray(nextSteps))
        stepNextSteps[result.stepId] = nextSteps
      if (outputs && isPlainObject(outputs))
        context = { ...context, ...outputs }
      if (!result.success)
        success = false
    }
    stepContext.params = context
  }

  return {
    flowName: flow.name,
    success,
    steps,
  }
}
