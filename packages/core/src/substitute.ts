/**
 * Replace {{ expression }} placeholders in template with values from context.
 * Uses SafeExpression evaluator.
 * undefined/null → ""; object/array → JSON.stringify; else String(value).
 */
import type { FlowStep } from './types'
import { evaluate } from './safeExpression'

export function substitute(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, expression: string) => {
    try {
      const value = evaluate(expression.trim(), context)
      if (value === undefined || value === null)
        return ''
      if (typeof value === 'object')
        return JSON.stringify(value)
      return String(value)
    }
    catch {
      return ''
    }
  })
}

/** Recursively substitute {{ expression }} in any value (string, object, array). Used for step payloads. */
export function substituteValue(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === 'string')
    return substitute(value, context)
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value))
      out[k] = substituteValue(v, context)
    return out
  }
  if (Array.isArray(value))
    return value.map(item => substituteValue(item, context))
  return value
}

/** Substitute all string values in step (except id, type) using context. */
export function substituteStep(step: FlowStep, context: Record<string, unknown>): FlowStep {
  const out: FlowStep = { id: step.id, type: step.type }
  for (const [k, v] of Object.entries(step)) {
    if (k === 'id' || k === 'type')
      continue
    out[k] = substituteValue(v, context)
  }
  return out
}
