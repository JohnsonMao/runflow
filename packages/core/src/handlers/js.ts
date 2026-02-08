// @env node
import type { FlowStep, IStepHandler, StepContext, StepResult } from '../types'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { runInNewContext } from 'node:vm'

const DEFAULT_JS_TIMEOUT_MS = 10_000

export class JsHandler implements IStepHandler {
  validate(step: FlowStep): true | string {
    const hasRun = typeof step.run === 'string'
    const hasFile = typeof step.file === 'string'
    return hasRun || hasFile ? true : 'js step requires run or file (string)'
  }

  async run(step: FlowStep, context: StepContext): Promise<StepResult> {
    let code: string
    const file = step.file
    if (typeof file === 'string') {
      if (!context.flowFilePath) {
        return {
          stepId: step.id,
          success: false,
          stdout: '',
          stderr: '',
          error: 'flowFilePath is required to run js step with file',
        }
      }
      if (file.endsWith('.ts')) {
        return {
          stepId: step.id,
          success: false,
          stdout: '',
          stderr: '',
          error: 'TypeScript (.ts) files are not supported',
        }
      }
      const resolved = path.resolve(path.dirname(context.flowFilePath), file)
      try {
        code = readFileSync(resolved, 'utf-8')
      }
      catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return {
          stepId: step.id,
          success: false,
          stdout: '',
          stderr: '',
          error: `Failed to load file: ${message}`,
        }
      }
    }
    else {
      const run = step.run
      code = typeof run === 'string' ? run : ''
    }
    const out: string[] = []
    const err: string[] = []
    const vmConsole = {
      log: (...args: unknown[]) => { out.push(args.map(String).join(' ')) },
      info: (...args: unknown[]) => { out.push(args.map(String).join(' ')) },
      warn: (...args: unknown[]) => { err.push(args.map(String).join(' ')) },
      error: (...args: unknown[]) => { err.push(args.map(String).join(' ')) },
    }
    const timeoutMs = typeof step.timeout === 'number' && step.timeout > 0 ? step.timeout : DEFAULT_JS_TIMEOUT_MS
    const outputKey = (typeof step.outputKey === 'string' ? step.outputKey : step.id) as string
    const vmContext = {
      console: vmConsole,
      params: { ...context.params },
      Promise,
    }
    try {
      const ret = runInNewContext(
        `(async function(){ ${code} })()`,
        vmContext,
        { timeout: timeoutMs },
      )
      const resolved = await Promise.resolve(ret)
      const result: StepResult = {
        stepId: step.id,
        success: true,
        stdout: out.join('\n'),
        stderr: err.join('\n'),
        outputs: { [outputKey]: resolved },
      }
      return result
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        stepId: step.id,
        success: false,
        stdout: out.join('\n'),
        stderr: err.join('\n'),
        error: message,
      }
    }
  }
}
