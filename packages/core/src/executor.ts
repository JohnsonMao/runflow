// @env node
import type { FlowDefinition, FlowStep, RunOptions, RunResult, StepContext, StepResult } from './types'
import { topologicalSort, validateDAG } from './dag'
import { paramsDeclarationToZodSchema } from './paramsSchema'
import { createDefaultRegistry } from './registry'
import { substitute } from './substitute'
import { isPlainObject } from './utils'

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
  const registry = { ...createDefaultRegistry(), ...(options.registry ?? {}) }
  const stepByIdMap = stepById(flow)

  if (options.dryRun) {
    for (const stepId of dagOrder) {
      steps.push({
        stepId,
        success: true,
        stdout: '',
        stderr: '',
      })
    }
    return {
      flowName: flow.name,
      success: true,
      steps,
    }
  }

  let context: Record<string, unknown> = { ...initialParams }
  let success = true
  const stepContext: StepContext = {
    params: context,
    flowFilePath: options.flowFilePath,
    flowName: flow.name,
  }
  const completed = new Set<string>()
  const stepNextSteps: Record<string, string[]> = {}

  while (true) {
    const runnable = getRunnable(dagOrder, completed, stepByIdMap, stepNextSteps)
    if (runnable.length === 0)
      break
    for (const stepId of runnable) {
      const step = stepByIdMap.get(stepId)!
      const substitutedStep = substituteStep(step, context)
      const entry = registry[step.type]
      if (!entry) {
        steps.push({
          stepId,
          success: false,
          stdout: '',
          stderr: '',
          error: `Unknown step type: ${step.type}`,
        })
        success = false
        completed.add(stepId)
        continue
      }
      if (entry.validate) {
        const valid = entry.validate(substitutedStep)
        if (valid !== true) {
          steps.push({
            stepId,
            success: false,
            stdout: '',
            stderr: '',
            error: valid,
          })
          success = false
          completed.add(stepId)
          continue
        }
      }
      try {
        const result = await entry.run(substitutedStep, stepContext)
        steps.push(result)
        completed.add(stepId)
        if (result.nextSteps !== undefined && Array.isArray(result.nextSteps))
          stepNextSteps[stepId] = result.nextSteps
        if (result.outputs && isPlainObject(result.outputs))
          context = { ...context, ...result.outputs }
        stepContext.params = context
        if (!result.success)
          success = false
      }
      catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        steps.push({
          stepId,
          success: false,
          stdout: '',
          stderr: '',
          error: message,
        })
        success = false
        completed.add(stepId)
      }
    }
  }

  return {
    flowName: flow.name,
    success,
    steps,
  }
}
