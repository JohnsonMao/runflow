// @env node
import type { FlowDefinition, RunOptions, RunResult, StepResult } from './types'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { paramsDeclarationToZodSchema } from './paramsSchema'
import { substitute } from './substitute'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function runJsStep(stepId: string, code: string, params: Record<string, unknown>): StepResult {
  const out: string[] = []
  const err: string[] = []
  const vmConsole = {
    log: (...args: unknown[]) => { out.push(args.map(String).join(' ')) },
    info: (...args: unknown[]) => { out.push(args.map(String).join(' ')) },
    warn: (...args: unknown[]) => { err.push(args.map(String).join(' ')) },
    error: (...args: unknown[]) => { err.push(args.map(String).join(' ')) },
  }
  const vmContext = {
    console: vmConsole,
    params: { ...params },
  }
  try {
    const ret = runInNewContext(
      `(function(){ ${code} })()`,
      vmContext,
      { timeout: 10_000 },
    )
    const result: StepResult = {
      stepId,
      success: true,
      stdout: out.join('\n'),
      stderr: err.join('\n'),
    }
    if (isPlainObject(ret))
      result.outputs = ret
    return result
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      stepId,
      success: false,
      stdout: out.join('\n'),
      stderr: err.join('\n'),
      error: message,
    }
  }
}

function runCommandStep(stepId: string, run: string): StepResult {
  try {
    const result = execSync(run, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    })
    return {
      stepId,
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
      stepId,
      success: false,
      stdout,
      stderr,
      error: message,
    }
  }
}

export function run(flow: FlowDefinition, options: RunOptions = {}): RunResult {
  const steps: StepResult[] = []
  let initialParams: Record<string, unknown> = { ...(options.params ?? {}) }

  if (flow.params && flow.params.length > 0) {
    const schema = paramsDeclarationToZodSchema(flow.params)
    const parsed = schema.safeParse(options.params ?? {})
    if (!parsed.success) {
      const msg = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
      return {
        flowName: flow.name,
        success: false,
        steps: [],
        error: msg,
      }
    }
    initialParams = parsed.data
  }

  if (options.dryRun) {
    for (const step of flow.steps) {
      steps.push({
        stepId: step.id,
        success: true,
        stdout: '',
        stderr: '',
      })
    }
    return {
      flowName: flow.name,
      success: true,
      steps,
    }
  }

  let context: Record<string, unknown> = { ...initialParams }
  let success = true
  for (const step of flow.steps) {
    if (step.type === 'command') {
      const runCmd = substitute(step.run, context)
      const result = runCommandStep(step.id, runCmd)
      steps.push(result)
      if (!result.success)
        success = false
    }
    else if (step.type === 'js') {
      let code = step.run
      if (step.file) {
        if (!options.flowFilePath) {
          steps.push({
            stepId: step.id,
            success: false,
            stdout: '',
            stderr: '',
            error: 'flowFilePath is required to run js step with file',
          })
          success = false
          continue
        }
        if (step.file.endsWith('.ts')) {
          steps.push({
            stepId: step.id,
            success: false,
            stdout: '',
            stderr: '',
            error: 'TypeScript (.ts) files are not supported',
          })
          success = false
          continue
        }
        const resolved = path.resolve(path.dirname(options.flowFilePath), step.file)
        try {
          code = readFileSync(resolved, 'utf-8')
        }
        catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          steps.push({
            stepId: step.id,
            success: false,
            stdout: '',
            stderr: '',
            error: `Failed to load file: ${message}`,
          })
          success = false
          continue
        }
      }
      const result = runJsStep(step.id, code, context)
      steps.push(result)
      if (result.outputs && isPlainObject(result.outputs))
        context = { ...context, ...result.outputs }
      if (!result.success)
        success = false
    }
  }
  return {
    flowName: flow.name,
    success,
    steps,
  }
}
