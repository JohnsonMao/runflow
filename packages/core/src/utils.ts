import type { HandlerConfig } from './handler-factory'
/** Normalize step id or array of step ids to string[]. Single string -> [s], array -> filter to strings, else []. */
import type { FlowDefinition, FlowStep, StepRegistry, StepResult } from './types'

export function buildRegistry(handlers: HandlerConfig[]): StepRegistry {
  const registry: StepRegistry = {}
  for (const handler of handlers) {
    registry[handler.type] = handler
  }
  return registry
}

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

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'client_secret',
  'client_id',
])

const MAX_BODY_LENGTH = 2048

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase())
}

export function redact(data: unknown): unknown {
  if (typeof data === 'string') {
    // Basic heuristic: if it looks like a bearer token or long secret?
    // For now, we only redact based on keys in objects.
    // If the data itself is a string and we don't know the context, we return as is.
    return data
  }
  if (Array.isArray(data)) {
    return data.map(item => redact(item))
  }
  if (isPlainObject(data)) {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        out[key] = '[REDACTED]'
      }
      else {
        out[key] = redact(value)
      }
    }
    return out
  }
  return data
}

export function truncate(text: string, maxLength: number = MAX_BODY_LENGTH): string {
  if (text.length <= maxLength)
    return text
  return `${text.slice(0, maxLength)}
... (truncated, use 'inspect' to view full)`
}
