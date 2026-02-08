// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'
import { isPlainObject } from '../utils'

export class SetHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    if (isPlainObject(step.set))
      return true
    return 'set step requires set (object)'
  }

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    const set = step.set
    if (!isPlainObject(set))
      return context.stepResult(step.id, false, { error: 'set step requires set (object)' })
    return context.stepResult(step.id, true, { outputs: { ...set } })
  }
}
