// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'
import { runInNewContext } from 'node:vm'
import { normalizeStepIds } from '../utils'

export class ConditionHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    if (typeof step.when !== 'string')
      return 'condition step requires when (string)'
    const thenIds = normalizeStepIds(step.then)
    const elseIds = normalizeStepIds(step.else)
    if (thenIds.length === 0 && elseIds.length === 0)
      return 'condition step requires at least one of then or else (step id or array of ids)'
    return true
  }

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    const when = step.when
    if (typeof when !== 'string')
      return context.stepResult(step.id, false, { error: 'condition step requires when (string)' })
    try {
      const value = runInNewContext(
        `(function(params){ return Boolean(${when}); })(params)`,
        { params: context.params },
        { timeout: 2000 },
      )
      const nextSteps = value ? normalizeStepIds(step.then) : normalizeStepIds(step.else)
      return context.stepResult(step.id, true, { nextSteps })
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return context.stepResult(step.id, false, { error: message })
    }
  }
}
