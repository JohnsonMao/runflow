import type { ParamDeclaration, ParamDeclarationWithoutName } from './types'
import { z } from 'zod'

const PARAM_TYPES = ['string', 'number', 'boolean', 'object', 'array'] as const

/** Build default value for a single param (used for nested schema defaults). */
function defaultForDecl(decl: ParamDeclarationWithoutName): unknown {
  if (decl.default !== undefined)
    return decl.default
  if (decl.type === 'object' && decl.schema && typeof decl.schema === 'object') {
    const obj: Record<string, unknown> = {}
    for (const [k, d] of Object.entries(decl.schema))
      obj[k] = defaultForDecl(d)
    return obj
  }
  return undefined
}

function baseSchemaForType(decl: ParamDeclarationWithoutName): z.ZodTypeAny {
  switch (decl.type) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'boolean':
      return z.boolean()
    case 'object':
      return objectSchema(decl.schema)
    case 'array':
      return arraySchema(decl.items)
    default:
      return z.unknown()
  }
}

function paramToZod(decl: ParamDeclarationWithoutName): z.ZodTypeAny {
  let out: z.ZodTypeAny = baseSchemaForType(decl)
  if (decl.enum != null && Array.isArray(decl.enum) && decl.enum.length > 0) {
    const literals = decl.enum.map(v => z.literal(v as string | number | boolean | null))
    out = literals.length === 1 ? literals[0]! : z.union(literals as [z.ZodLiteral<unknown>, z.ZodLiteral<unknown>, ...z.ZodLiteral<unknown>[]])
  }
  if (!decl.required)
    out = (out as z.ZodTypeAny).optional()
  let defaultVal: unknown
  if (decl.default !== undefined)
    defaultVal = decl.default
  else if (decl.type === 'object' && decl.schema && typeof decl.schema === 'object')
    defaultVal = defaultForDecl(decl)
  else
    defaultVal = undefined
  if (defaultVal !== undefined)
    out = (out as z.ZodTypeAny).default(defaultVal)
  return out
}

function objectSchema(schema?: Record<string, ParamDeclarationWithoutName>): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') {
    return z.record(z.string(), z.unknown())
  }
  const shape: z.ZodRawShape = {}
  for (const [key, decl] of Object.entries(schema)) {
    shape[key] = paramToZod(decl)
  }
  return z.object(shape).strict()
}

function arraySchema(items?: ParamDeclarationWithoutName): z.ZodArray<z.ZodTypeAny> {
  if (!items)
    return z.array(z.unknown())
  return z.array(paramToZod(items))
}

/**
 * Build a Zod schema from a flow's params declaration array.
 * Validates declared params; unknown keys are passed through so global config params can reach context.
 */
export function paramsDeclarationToZodSchema(declarations: ParamDeclaration[]): z.ZodType<Record<string, unknown>> {
  if (!declarations.length) {
    return z.record(z.unknown()) as z.ZodType<Record<string, unknown>>
  }
  const shape: z.ZodRawShape = {}
  for (const decl of declarations) {
    const key = decl.name
    if (key)
      shape[key] = paramToZod(decl)
  }
  return z.object(shape).passthrough()
}

export function isParamType(value: unknown): value is ParamDeclaration['type'] {
  return typeof value === 'string' && PARAM_TYPES.includes(value as ParamDeclaration['type'])
}

/** Resolve param declaration at path (e.g. [] -> undefined, ['title'] -> top-level, ['options','level'] -> nested). */
function getParamDeclAtPath(
  declarations: ParamDeclaration[],
  path: (string | number)[],
): ParamDeclaration | ParamDeclarationWithoutName | undefined {
  if (path.length === 0) {
    return undefined
  }
  const key = String(path[0])
  const top = declarations.find(d => d.name === key)
  if (!top) {
    return undefined
  }
  if (path.length === 1) {
    return top
  }
  if (!top.schema || typeof top.schema !== 'object') {
    return undefined
  }
  const nestedKey = String(path[1])
  const nested = top.schema[nestedKey]
  if (!nested) {
    return undefined
  }
  if (path.length === 2) {
    return nested
  }
  if (!nested.schema || typeof nested.schema !== 'object') {
    return undefined
  }
  return getParamDeclAtPathNested(nested.schema, path.slice(2))
}

function getParamDeclAtPathNested(
  schema: Record<string, ParamDeclarationWithoutName>,
  path: (string | number)[],
): ParamDeclarationWithoutName | undefined {
  if (path.length === 0) {
    return undefined
  }
  const key = String(path[0])
  const decl = schema[key]
  if (!decl) {
    return undefined
  }
  if (path.length === 1) {
    return decl
  }
  if (!decl.schema || typeof decl.schema !== 'object') {
    return undefined
  }
  return getParamDeclAtPathNested(decl.schema, path.slice(1))
}

export interface ParamValidationError {
  path: (string | number)[]
  message: string
}

/**
 * Format Zod params validation errors with param descriptions when available.
 * Example: "title: Required" -> "title (required): Required — 顯示用標題"
 */
export function formatParamsValidationError(
  declarations: ParamDeclaration[],
  errors: ParamValidationError[],
): string {
  return errors
    .map((e) => {
      const pathStr = e.path.join('.')
      const decl = getParamDeclAtPath(declarations, e.path)
      const requiredLabel = decl && 'required' in decl && decl.required ? ' (required)' : ''
      const desc = decl?.description ? ` — ${decl.description}` : ''
      return `${pathStr}${requiredLabel}: ${e.message}${desc}`
    })
    .join('; ')
}
