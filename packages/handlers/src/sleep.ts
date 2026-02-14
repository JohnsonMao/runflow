// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '@runflow/core'

/** Max sleep duration in milliseconds (1 hour). Prevents long-blocking DoS. */
export const SLEEP_MAX_MS = 3600 * 1000

export class SleepHandler implements IStepHandler {
  private timer: NodeJS.Timeout | null = null

  validate(step: FlowStep): true | string {
    const hasSeconds = typeof step.seconds === 'number' && step.seconds >= 0
    const hasMs = typeof step.ms === 'number' && step.ms >= 0
    if (hasSeconds || hasMs)
      return true
    return 'sleep step requires seconds or ms (non-negative number)'
  }

  kill(): void {
    if (this.timer)
      clearTimeout(this.timer)
  }

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    const seconds = step.seconds
    const ms = step.ms
    let durationMs: number
    if (typeof seconds === 'number' && seconds >= 0)
      durationMs = Math.min(seconds * 1000, SLEEP_MAX_MS)
    else if (typeof ms === 'number' && ms >= 0)
      durationMs = Math.min(ms, SLEEP_MAX_MS)
    else
      return context.stepResult(step.id, false, { error: 'sleep step requires seconds or ms (non-negative number)' })
    await new Promise<void>((resolve) => {
      this.timer = setTimeout(resolve, durationMs)
    })
    const logMsg = typeof seconds === 'number' && seconds >= 0
      ? `slept ${seconds}s`
      : `slept ${durationMs}ms`
    return context.stepResult(step.id, true, { log: logMsg })
  }
}
