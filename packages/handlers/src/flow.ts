// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '@runflow/core'
import { isPlainObject } from '@runflow/core'

export class FlowHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    if (typeof step.flow !== 'string' || step.flow.trim() === '')
      return 'flow step requires flow (non-empty string path)'
    if (step.params !== undefined && !isPlainObject(step.params))
      return 'flow step params must be an object when present'
    return true
  }

  kill(): void {}

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    if (!context.runFlow)
      return context.stepResult(step.id, false, { error: 'runFlow not available (flow step cannot run outside executor)' })
    const path = step.flow as string | undefined
    if (typeof path !== 'string')
      return context.stepResult(step.id, false, { error: 'flow step requires flow (string path)' })
    const params = isPlainObject(step.params) ? (step.params as Record<string, unknown>) : {}
    try {
      const result = await context.runFlow(path, params)
      const mergedOutputs: Record<string, unknown> = {}
      for (const sr of result.steps) {
        if (sr.outputs && isPlainObject(sr.outputs))
          Object.assign(mergedOutputs, sr.outputs)
      }
      if (result.success)
        return context.stepResult(step.id, true, { outputs: mergedOutputs })
      const errorMessage = result.error ?? result.steps.find(s => !s.success)?.error ?? 'callee flow failed'
      return context.stepResult(step.id, false, { error: errorMessage, outputs: Object.keys(mergedOutputs).length > 0 ? mergedOutputs : undefined })
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return context.stepResult(step.id, false, { error: message })
    }
  }
}
