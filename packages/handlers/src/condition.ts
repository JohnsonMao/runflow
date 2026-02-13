// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '@runflow/core'
import { evaluateToBoolean, normalizeStepIds } from '@runflow/core'

export class ConditionHandler implements IStepHandler {
  getAllowedDependentIds(step: FlowStep): string[] {
    return [...normalizeStepIds(step.then), ...normalizeStepIds(step.else)]
  }

  validate(step: FlowStep): true | string {
    if (typeof step.when !== 'string')
      return 'condition step requires when (string)'
    const thenIds = normalizeStepIds(step.then)
    const elseIds = normalizeStepIds(step.else)
    if (thenIds.length === 0 && elseIds.length === 0)
      return 'condition step requires at least one of then or else (step id or array of ids)'
    return true
  }

  kill(): void {}

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    const when = step.when as string | undefined
    if (typeof when !== 'string')
      return context.stepResult(step.id, false, { error: 'condition step requires when (string)' })
    try {
      const value = evaluateToBoolean(when, context.params, { maxLength: 2000 })
      const nextSteps = value ? normalizeStepIds(step.then) : normalizeStepIds(step.else)
      return context.stepResult(step.id, true, { nextSteps })
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return context.stepResult(step.id, false, { error: message })
    }
  }
}
