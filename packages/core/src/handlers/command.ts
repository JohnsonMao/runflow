// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'
import { execSync } from 'node:child_process'

export class CommandHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    return typeof step.run === 'string' ? true : 'command step requires run (string)'
  }

  async run(step: FlowStep, _context: StepContext): Promise<StepResult> {
    const run = step.run
    if (typeof run !== 'string') {
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: 'command step requires run (string)',
      }
    }
    try {
      const result = execSync(run, {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
      })
      return {
        stepId: step.id,
        success: true,
        stdout: result,
        stderr: '',
      }
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const stdout = err && typeof err === 'object' && 'stdout' in err && typeof (err as { stdout: unknown }).stdout === 'string'
        ? (err as { stdout: string }).stdout
        : ''
      const stderr = err && typeof err === 'object' && 'stderr' in err && typeof (err as { stderr: unknown }).stderr === 'string'
        ? (err as { stderr: string }).stderr
        : ''
      return {
        stepId: step.id,
        success: false,
        stdout,
        stderr,
        error: message,
      }
    }
  }
}
