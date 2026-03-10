import type { FlowDetail } from '../types'

export function initialParamValuesFromDetail(detail: FlowDetail): Record<string, unknown> {
  const initial: Record<string, unknown> = {}
  for (const p of detail.params ?? []) {
    if (p.type === 'object' && p.schema && Object.keys(p.schema).length > 0) {
      const nested: Record<string, unknown> = (p.default != null && typeof p.default === 'object')
        ? { ...(p.default as Record<string, unknown>) }
        : {}
      for (const [k, prop] of Object.entries(p.schema)) {
        if (prop.default !== undefined && !(k in nested))
          nested[k] = prop.default
      }
      initial[p.name] = nested
    }
    else if (p.default !== undefined) {
      initial[p.name] = p.default
    }
  }
  return initial
}
