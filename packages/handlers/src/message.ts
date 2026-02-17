// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '@runflow/core'

export class MessageHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    if (typeof step.message === 'string')
      return true
    return 'message step requires message (string)'
  }

  kill(): void {}

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    if (typeof step.message !== 'string')
      return context.stepResult(step.id, false, { error: 'message step requires message (string)' })
    return context.stepResult(step.id, true, { log: step.message })
  }
}
