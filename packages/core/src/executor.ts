import type { FlowDefinition, RunResult, StepResult } from './types'
// @env node
import { execSync } from 'node:child_process'
import { runInNewContext } from 'node:vm'

function runJsStep(stepId: string, code: string): StepResult {
  const out: string[] = []
  const err: string[] = []
  const vmConsole = {
    log: (...args: unknown[]) => { out.push(args.map(String).join(' ')) },
    info: (...args: unknown[]) => { out.push(args.map(String).join(' ')) },
    warn: (...args: unknown[]) => { err.push(args.map(String).join(' ')) },
    error: (...args: unknown[]) => { err.push(args.map(String).join(' ')) },
  }
  try {
    runInNewContext(
      `(function(){ ${code} })()`,
      { console: vmConsole },
      { timeout: 10_000 },
    )
    return {
      stepId,
      success: true,
      stdout: out.join('\n'),
      stderr: err.join('\n'),
    }
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

export function run(flow: FlowDefinition, options: { dryRun?: boolean } = {}): RunResult {
  const steps: StepResult[] = []
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
  let success = true
  for (const step of flow.steps) {
    if (step.type === 'command') {
      const result = runCommandStep(step.id, step.run)
      steps.push(result)
      if (!result.success)
        success = false
    }
    else if (step.type === 'js') {
      const result = runJsStep(step.id, step.run)
      steps.push(result)
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
