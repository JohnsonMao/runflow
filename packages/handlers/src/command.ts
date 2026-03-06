// @env node
import type { FactoryContext } from '@runflow/core'
import { execSync } from 'node:child_process'

function commandHandler({ defineHandler, z }: FactoryContext) {
  return defineHandler({
    type: 'command',
    schema: z.object({
      run: z.string(),
      timeout: z.number().optional(),
      cwd: z.string().optional(),
      env: z.record(z.string()).optional(),
    }),
    run: async (context) => {
      const { step } = context
      const { cwd, run, timeout } = step
      const env = step.env ? { ...process.env, ...step.env } : process.env

      try {
        const stdout = execSync(run, {
          cwd,
          env,
          timeout: timeout ? timeout * 1000 : undefined,
          encoding: 'utf-8',
        })
        return {
          success: true,
          outputs: { stdout: stdout.trim() },
          log: `Executed: ${run}`,
        }
      }
      catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return {
          success: false,
          error: message,
        }
      }
    },
  })
}

export default commandHandler
