// @env node
import type { FlowDefinition, FlowStep, RunOptions, RunResult, StepContext, StepResult } from './types'
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

  const registry = { ...createDefaultRegistry(), ...(options.registry ?? {}) }

  if (options.dryRun) {
    for (const step of flow.steps) {
      steps.push({
        stepId: step.id,
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

  for (const step of flow.steps) {
    const substitutedStep = substituteStep(step, context)
    const entry = registry[step.type]
    if (!entry) {
      steps.push({
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: `Unknown step type: ${step.type}`,
      })
      success = false
      continue
    }
    if (entry.validate) {
      const valid = entry.validate(substitutedStep)
      if (valid !== true) {
        steps.push({
          stepId: step.id,
          success: false,
          stdout: '',
          stderr: '',
          error: valid,
        })
        success = false
        continue
      }
    }
    try {
      const result = await entry.run(substitutedStep, stepContext)
      steps.push(result)
      if (result.outputs && isPlainObject(result.outputs))
        context = { ...context, ...result.outputs }
      stepContext.params = context
      if (!result.success)
        success = false
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      steps.push({
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: message,
      })
      success = false
    }
  }
  return {
    flowName: flow.name,
    success,
    steps,
  }
}
