export function getNested(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const key of parts) {
    cur = cur != null && typeof cur === 'object' && key in cur
      ? (cur as Record<string, unknown>)[key]
      : undefined
  }
  return cur
}

export function setNested(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = path.split('.')
  if (parts.length === 1)
    return { ...obj, [path]: value }
  const [head, ...rest] = parts
  const next = (obj[head] != null && typeof obj[head] === 'object')
    ? { ...(obj[head] as Record<string, unknown>) }
    : {}
  return {
    ...obj,
    [head]: setNested(next, rest.join('.'), value),
  }
}
