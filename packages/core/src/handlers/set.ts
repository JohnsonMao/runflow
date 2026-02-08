// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'
import { isPlainObject } from '../utils'

export class SetHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    if (isPlainObject(step.set))
      return true
    return 'set step requires set (object)'
  }

  async run(step: FlowStep, _context: StepContext): Promise<StepResult> {
    const set = step.set
    if (!isPlainObject(set)) {
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: 'set step requires set (object)',
      }
    }
    return {
      stepId: step.id,
      success: true,
      stdout: '',
      stderr: '',
      outputs: { ...set },
    }
  }
}
