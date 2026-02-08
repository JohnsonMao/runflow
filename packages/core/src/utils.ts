/** Type guard: plain object (non-null, object, not array). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Convert kebab-case string to camelCase (e.g. depends-on -> dependsOn). */
export function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * Recursively convert all object keys from kebab-case to camelCase.
 * Arrays are traversed; array element keys are converted. Primitives returned as-is.
 */
export function convertKeysKebabToCamel(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(convertKeysKebabToCamel)
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value))
      out[kebabToCamel(k)] = convertKeysKebabToCamel(v)
    return out
  }
  return value
}
