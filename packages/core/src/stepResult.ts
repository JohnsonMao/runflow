import type { StepResult, StepResultOptions } from './types'

/**
 * Build a StepResult with consistent shape and defaults.
 * Executor injects this as context.stepResult so handlers use it; executor also uses it internally.
 */
export function stepResult(
  stepId: string,
  success: boolean,
  opts: StepResultOptions = {},
): StepResult {
  const out: StepResult = {
    stepId,
    success,
  }
  if (opts.error !== undefined)
    out.error = opts.error
  if (opts.outputs !== undefined)
    out.outputs = opts.outputs
  if (opts.log !== undefined)
    out.log = opts.log
  if (opts.nextSteps !== undefined)
    out.nextSteps = opts.nextSteps
  if (opts.completedStepIds !== undefined)
    out.completedStepIds = opts.completedStepIds
  return out
}
