import type { StepResult, StepResultOptions } from '@runflow/core'

/** Minimal stepResult for building StepContext in tests (engine provides the real one at runtime). */
export const stepResult: (stepId: string, success: boolean, opts?: StepResultOptions) => StepResult = (
  stepId,
  success,
  opts = {},
) => {
  const out: StepResult = { stepId, success }
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
  if (opts.subSteps !== undefined)
    out.subSteps = opts.subSteps
  return out
}
