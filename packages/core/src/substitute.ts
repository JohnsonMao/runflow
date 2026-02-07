/**
 * Replace {{ path }} placeholders in template with values from context.
 * Path supports: key, key.nested, key[0], key.a[1].b
 * undefined/null → ""; object/array → JSON.stringify; else String(value).
 */
export function substitute(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
    const value = resolvePath(path.trim(), context)
    if (value === undefined || value === null)
      return ''
    if (typeof value === 'object')
      return JSON.stringify(value)
    return String(value)
  })
}

function resolvePath(path: string, context: Record<string, unknown>): unknown {
  const parts = splitPath(path)
  let current: unknown = context
  for (const part of parts) {
    if (current === undefined || current === null)
      return undefined
    if (part.type === 'prop')
      current = (current as Record<string, unknown>)[part.name]
    else
      current = (current as unknown[])[part.index]
  }
  return current
}

type PathPart = { type: 'prop', name: string } | { type: 'index', index: number }

function splitPath(path: string): PathPart[] {
  const parts: PathPart[] = []
  let i = 0
  while (i < path.length) {
    if (path[i] === '.') {
      i += 1
      const start = i
      while (i < path.length && /[\w$]/u.test(path[i]!))
        i += 1
      parts.push({ type: 'prop', name: path.slice(start, i) })
      continue
    }
    const bracket = path.indexOf('[', i)
    const dot = path.indexOf('.', i)
    if (bracket === -1 && dot === -1) {
      const name = path.slice(i).trim()
      if (name)
        parts.push({ type: 'prop', name })
      break
    }
    if (bracket !== -1 && (dot === -1 || bracket < dot)) {
      if (bracket > i) {
        const name = path.slice(i, bracket).trim()
        if (name)
          parts.push({ type: 'prop', name })
      }
      i = bracket + 1
      const end = path.indexOf(']', i)
      if (end === -1)
        break
      const num = Number.parseInt(path.slice(i, end), 10)
      if (Number.isNaN(num))
        break
      parts.push({ type: 'index', index: num })
      i = end + 1
      continue
    }
    if (dot !== -1) {
      const name = path.slice(i, dot).trim()
      if (name)
        parts.push({ type: 'prop', name })
      i = dot + 1
    }
  }
  return parts
}
