import type { ParamDeclaration, ParamDeclarationWithoutName } from './types'
import { z } from 'zod'

const PARAM_TYPES = ['string', 'number', 'boolean', 'object', 'array'] as const

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
  if (decl.default !== undefined)
    out = (out as z.ZodTypeAny).default(decl.default)
  if (!decl.required)
    out = (out as z.ZodTypeAny).optional()
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
 * Validates the whole params object (all declared params at top level).
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
  return z.object(shape).strict()
}

export function isParamType(value: unknown): value is ParamDeclaration['type'] {
  return typeof value === 'string' && PARAM_TYPES.includes(value as ParamDeclaration['type'])
}
