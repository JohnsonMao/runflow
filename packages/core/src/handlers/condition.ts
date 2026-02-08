// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'
import { runInNewContext } from 'node:vm'

function normalizeThenElse(v: unknown): string[] {
  if (typeof v === 'string')
    return [v]
  if (Array.isArray(v))
    return v.filter((x): x is string => typeof x === 'string')
  return []
}

export class ConditionHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    if (typeof step.when !== 'string')
      return 'condition step requires when (string)'
    const thenIds = normalizeThenElse(step.then)
    const elseIds = normalizeThenElse(step.else)
    if (thenIds.length === 0 && elseIds.length === 0)
      return 'condition step requires at least one of then or else (step id or array of ids)'
    return true
  }

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    const when = step.when
    if (typeof when !== 'string') {
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: 'condition step requires when (string)',
      }
    }
    try {
      const value = runInNewContext(
        `(function(params){ return Boolean(${when}); })(params)`,
        { params: context.params },
        { timeout: 2000 },
      )
      const result = Boolean(value)
      const thenIds = normalizeThenElse(step.then)
      const elseIds = normalizeThenElse(step.else)
      const nextSteps = result ? thenIds : elseIds
      return {
        stepId: step.id,
        success: true,
        stdout: '',
        stderr: '',
        nextSteps,
      }
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: message,
      }
    }
  }
}
