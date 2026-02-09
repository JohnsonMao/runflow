import type { HooksEntry, OpenApiToFlowsOptions, OperationHooks } from './types.js'

/**
 * Resolve merged hooks for an operation key. Supports Record (exact key) and HooksEntry[] (pattern + regex).
 */
export function resolveHooksForKey(
  key: string,
  hooks: OpenApiToFlowsOptions['hooks'],
): OperationHooks | undefined {
  if (!hooks)
    return undefined
  if (Array.isArray(hooks)) {
    const before: OperationHooks['before'] = []
    const after: OperationHooks['after'] = []
    for (const entry of hooks as HooksEntry[]) {
      const match = typeof entry.pattern === 'string'
        ? entry.pattern === key
        : entry.pattern.test(key)
      if (match && entry.hooks) {
        if (entry.hooks.before?.length)
          before.push(...entry.hooks.before)
        if (entry.hooks.after?.length)
          after.push(...entry.hooks.after)
      }
    }
    if (before.length === 0 && after.length === 0)
      return undefined
    return { before, after }
  }
  return (hooks as Partial<Record<string, OperationHooks>>)[key]
}
