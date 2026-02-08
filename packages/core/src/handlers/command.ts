// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'
import { spawn } from 'node:child_process'
import { isPlainObject } from '../utils'

export class CommandHandler implements IStepHandler {
  private currentChild: ReturnType<typeof spawn> | null = null

  validate(step: FlowStep): true | string {
    return typeof step.run === 'string' ? true : 'command step requires run (string)'
  }

  kill(): void {
    if (this.currentChild) {
      this.currentChild.kill('SIGTERM')
      this.currentChild = null
    }
  }

  async run(step: FlowStep, _context: StepContext): Promise<StepResult> {
    const run = step.run as string | undefined
    if (typeof run !== 'string') {
      return {
        stepId: step.id,
        success: false,
        stdout: '',
        stderr: '',
        error: 'command step requires run (string)',
      }
    }
    const cwd = step.cwd !== undefined && step.cwd !== null && step.cwd !== ''
      ? (typeof step.cwd === 'string' ? step.cwd : String(step.cwd))
      : undefined
    const env = step.env !== undefined && isPlainObject(step.env)
      ? { ...process.env, ...step.env as Record<string, string> }
      : undefined
    return this.runSpawn(step.id, run, cwd, env)
  }

  private runSpawn(stepId: string, run: string, cwd?: string, env?: NodeJS.ProcessEnv): Promise<StepResult> {
    const child = spawn(run, [], {
      shell: true,
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.currentChild = child
    const chunks: { out: string[], err: string[] } = { out: [], err: [] }
    child.stdout?.setEncoding('utf-8')
    child.stderr?.setEncoding('utf-8')
    child.stdout?.on('data', (chunk: string) => chunks.out.push(chunk))
    child.stderr?.on('data', (chunk: string) => chunks.err.push(chunk))
    return new Promise((resolve) => {
      child.on('close', (code, signal) => {
        this.currentChild = null
        const stdout = chunks.out.join('')
        const stderr = chunks.err.join('')
        if (code === 0 && !signal) {
          resolve({ stepId, success: true, stdout, stderr })
        }
        else {
          const reason = signal ? `killed by signal ${signal}` : `exit code ${code}`
          resolve({ stepId, success: false, stdout, stderr, error: reason })
        }
      })
      child.on('error', (err) => {
        this.currentChild = null
        resolve({
          stepId,
          success: false,
          stdout: chunks.out.join(''),
          stderr: chunks.err.join(''),
          error: err.message,
        })
      })
    })
  }
}
