// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'

export class SleepHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    const hasSeconds = typeof step.seconds === 'number' && step.seconds >= 0
    const hasMs = typeof step.ms === 'number' && step.ms >= 0
    if (hasSeconds || hasMs)
      return true
    return 'sleep step requires seconds or ms (non-negative number)'
  }

  async run(step: FlowStep, _context: StepContext): Promise<StepResult> {
    const seconds = step.seconds
    const ms = step.ms
    let durationMs: number
    if (typeof seconds === 'number' && seconds >= 0) {
      durationMs = seconds * 1000
    }
    else if (typeof ms === 'number' && ms >= 0) {
      durationMs = ms
    }
    else {
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: 'sleep step requires seconds or ms (non-negative number)',
      }
    }
    await new Promise<void>(resolve => setTimeout(resolve, durationMs))
    return {
      stepId: step.id,
      success: true,
      stdout: '',
      stderr: '',
    }
  }
}
