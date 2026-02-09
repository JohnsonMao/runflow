import type { OpenApiDocument, OperationFilter } from './types.js'

const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head'] as const

/**
 * Filename-safe operation key: lowercase method + path with leading / removed,
 * / → -, {param} → param. Same as the written flow filename (without .yaml).
 * e.g. get-users, get-users-id
 */
export function toOperationKey(method: string, path: string): string {
  const methodLower = method.toLowerCase()
  const pathPart = path
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/\{(\w+)\}/g, '$1')
  return pathPart ? `${methodLower}-${pathPart}` : methodLower
}

export interface CollectedOperation {
  key: string
  path: string
  method: string
  pathItem: Record<string, unknown>
  operation: Record<string, unknown>
}

export function collectOperations(
  doc: OpenApiDocument,
  filter?: OperationFilter,
): CollectedOperation[] {
  const paths = doc.paths ?? {}
  const out: CollectedOperation[] = []

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object')
      continue
    const item = pathItem as Record<string, unknown>
    for (const method of METHODS) {
      const op = item[method]
      if (!op || typeof op !== 'object')
        continue
      const operation = op as Record<string, unknown>
      const methodLower = (method as string).toLowerCase()
      const key = toOperationKey(method as string, path)

      if (filter) {
        if (filter.method && filter.method.toLowerCase() !== methodLower)
          continue
        if (filter.path && filter.path !== path)
          continue
        if (filter.operationId && filter.operationId !== operation.operationId)
          continue
        if (filter.tags?.length) {
          const opTags = (operation.tags as string[] | undefined) ?? []
          const hasTag = filter.tags.some(t => opTags.includes(t))
          if (!hasTag)
            continue
        }
      }

      out.push({
        key,
        path,
        method: methodLower,
        pathItem: item,
        operation,
      })
    }
  }

  return out
}
