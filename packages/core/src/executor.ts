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

async function runHttpStep(
  stepId: string,
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  outputKey: string,
  allowErrorStatus: boolean,
): Promise<StepResult> {
  try {
    const init: RequestInit = {
      method: method || 'GET',
      headers: Object.keys(headers).length ? headers : undefined,
      body: body !== undefined && body !== '' ? body : undefined,
    }
    const response = await fetch(url, init)
    const statusCode = response.status
    const headersObj: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headersObj[key] = value
    })
    const contentType = response.headers.get('content-type') ?? ''
    let bodyValue: unknown
    if (contentType.includes('application/json')) {
      const text = await response.text()
      try {
        bodyValue = text ? JSON.parse(text) : null
      }
      catch {
        bodyValue = text
      }
    }
    else {
      bodyValue = await response.text()
    }
    const responseObject = { statusCode, headers: headersObj, body: bodyValue }
    const is2xx = statusCode >= 200 && statusCode < 300
    if (is2xx) {
      return {
        stepId,
        success: true,
        stdout: '',
        stderr: '',
        outputs: { [outputKey]: responseObject },
      }
    }
    if (allowErrorStatus) {
      return {
        stepId,
        success: false,
        stdout: '',
        stderr: '',
        error: `HTTP ${statusCode}`,
        outputs: { [outputKey]: responseObject },
      }
    }
    return {
      stepId,
      success: false,
      stdout: '',
      stderr: '',
      error: `HTTP ${statusCode}`,
    }
  }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      stepId,
      success: false,
      stdout: '',
      stderr: '',
      error: message,
    }
  }
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

export async function run(flow: FlowDefinition, options: RunOptions = {}): Promise<RunResult> {
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
    else if (step.type === 'http') {
      const outputKey = step.output ?? step.id
      const url = substitute(step.url, context)
      const method = substitute(step.method ?? 'GET', context)
      const headers: Record<string, string> = {}
      if (step.headers) {
        for (const [k, v] of Object.entries(step.headers))
          headers[k] = substitute(v, context)
      }
      const body = step.body !== undefined ? substitute(step.body, context) : undefined
      const result = await runHttpStep(
        step.id,
        url,
        method,
        headers,
        body,
        outputKey,
        step.allowErrorStatus ?? false,
      )
      steps.push(result)
      if (result.outputs && isPlainObject(result.outputs))
        context = { ...context, ...result.outputs }
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
