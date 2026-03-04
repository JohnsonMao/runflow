// @env node
import type { FactoryContext } from '@runflow/core'

/** Max sleep duration in milliseconds (1 hour). Prevents long-blocking DoS. */
export const SLEEP_MAX_MS = 3600 * 1000

function sleepHandler({ defineHandler, z }: FactoryContext) {
  return defineHandler({
    schema: z.object({
      seconds: z.number().nonnegative().optional(),
      ms: z.number().nonnegative().optional(),
    }).refine(
      (data) => {
        const hasSeconds = typeof data.seconds === 'number' && data.seconds >= 0
        const hasMs = typeof data.ms === 'number' && data.ms >= 0
        return hasSeconds || hasMs
      },
      {
        message: 'sleep step requires seconds or ms (non-negative number)',
      },
    ),
    run: async (context) => {
      const { step, signal } = context
      const seconds = step.seconds
      const ms = step.ms

      let durationMs: number
      if (typeof seconds === 'number' && seconds >= 0) {
        durationMs = Math.min(seconds * 1000, SLEEP_MAX_MS)
      }
      else if (typeof ms === 'number' && ms >= 0) {
        durationMs = Math.min(ms, SLEEP_MAX_MS)
      }
      else {
        return {
          success: false,
          error: 'sleep step requires seconds or ms (non-negative number)',
        }
      }

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, durationMs)
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('sleep aborted'))
        }, { once: true })
      })

      const logMsg = typeof seconds === 'number' && seconds >= 0
        ? `slept ${seconds}s`
        : `slept ${durationMs}ms`

      return {
        success: true,
        log: logMsg,
      }
    },
  })
}

export default sleepHandler
