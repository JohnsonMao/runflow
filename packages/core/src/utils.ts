/** Normalize step id or array of step ids to string[]. Single string -> [s], array -> filter to strings, else []. */
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
