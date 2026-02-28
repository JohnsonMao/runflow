/** Normalize step id or array of step ids to string[]. Single string -> [s], array -> filter to strings, else []. */
import type { FlowDefinition, FlowStep, StepResult } from './types'

export function normalizeStepIds(v: unknown): string[] {
  if (typeof v === 'string')
    return [v]
  if (Array.isArray(v))
    return v.filter((x): x is string => typeof x === 'string')
  return []
}

/** Type guard: plain object (non-null, object, not array). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Build map step id → FlowStep for a flow. */
export function buildStepByIdMap(flow: FlowDefinition): Map<string, FlowStep> {
  const m = new Map<string, FlowStep>()
  for (const s of flow.steps)
    m.set(s.id, s)
  return m
}

/** Context key for step outputs: step.outputKey when present and string, otherwise stepId. */
export function getEffectiveOutputKey(step: FlowStep | undefined, stepId: string): string {
  return (step && typeof step.outputKey === 'string') ? step.outputKey : stepId
}

/** Merge batch step results into base context (each result's outputs under effectiveKey). */
export function mergeBatchResultsIntoContext(
  batch: Array<{ result: StepResult }>,
  stepByIdMap: Map<string, FlowStep>,
  baseContext: Record<string, unknown>,
): Record<string, unknown> {
  return batch.reduce<Record<string, unknown>>((acc, { result: r }) => {
    const out = r.outputs && isPlainObject(r.outputs) ? r.outputs : {}
    const key = getEffectiveOutputKey(stepByIdMap.get(r.stepId), r.stepId)
    return { ...acc, [key]: out }
  }, { ...baseContext })
}
