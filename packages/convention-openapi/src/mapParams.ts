import type { ParamDeclaration } from '@runflow/core'
import type { CollectedOperation } from './collectOperations.js'
import type { OpenApiDocument, OpenApiSchema, ParameterObject } from './types.js'

type FlowParamType = ParamDeclaration['type']

/** Resolve #/components/schemas/<name> to the actual schema. */
function resolveRef(ref: string, doc: OpenApiDocument): OpenApiSchema | undefined {
  const match = /^#\/components\/schemas\/(.+)$/.exec(ref)
  if (!match)
    return undefined
  return doc.components?.schemas?.[match[1]]
}

/**
 * Resolve $ref and allOf so we get a concrete schema with type/properties.
 * - $ref → resolve from doc.components.schemas
 * - allOf → merge into one object schema (required concat, properties assign)
 */
export function resolveSchema(schema: OpenApiSchema | undefined, doc: OpenApiDocument | null): OpenApiSchema | undefined {
  if (!schema)
    return undefined
  let current: OpenApiSchema = schema
  while (current.$ref) {
    if (!doc)
      break
    const resolved = resolveRef(current.$ref, doc)
    if (!resolved)
      break
    current = resolved
  }
  if (current.allOf?.length && doc) {
    const merged: OpenApiSchema = { type: 'object', properties: {}, required: [] }
    const reqSet = new Set<string>()
    for (const item of current.allOf) {
      const resolved = resolveSchema(item, doc) ?? item
      if (resolved.required)
        resolved.required.forEach(r => reqSet.add(r))
      if (resolved.properties)
        merged.properties = { ...merged.properties, ...resolved.properties }
    }
    merged.required = Array.from(reqSet)
    if (current.description)
      merged.description = current.description
    return merged
  }
  return current
}

function schemaTypeToParamType(schema?: OpenApiSchema): FlowParamType {
  if (!schema)
    return 'string'
  if (schema.allOf?.length)
    return 'object'
  if (!schema.type)
    return 'string'
  switch (schema.type) {
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return 'array'
    case 'object':
      return 'object'
    default:
      return 'string'
  }
}

function schemaToParamDeclaration(name: string, schema: OpenApiSchema, required?: boolean): ParamDeclaration {
  const type = schemaTypeToParamType(schema)
  const decl: ParamDeclaration = {
    name,
    type,
    required: required ?? false,
  }
  if (schema.description)
    decl.description = schema.description
  if (schema.enum)
    decl.enum = schema.enum
  if (type === 'object' && schema.properties) {
    const reqSet = new Set(schema.required ?? [])
    decl.schema = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [
        k,
        schemaToParamDeclaration(k, v, reqSet.has(k)),
      ]),
    )
  }
  if (type === 'array' && schema.items)
    decl.items = schemaToParamDeclaration('item', schema.items, false)
  return decl
}

/**
 * Map OpenAPI operation to param declarations. When doc is provided, resolves
 * $ref and allOf for request body (and param) schemas so body is typed as object
 * with properties (e.g. PayByTxnTokenRequestEntity) instead of string.
 */
export function mapParamsToDeclarations(op: CollectedOperation, doc: OpenApiDocument | null = null): ParamDeclaration[] {
  const params: ParamDeclaration[] = []
  const seen = new Set<string>()

  const pathParams = (op.pathItem.parameters as ParameterObject[] | undefined) ?? []
  const opParams = (op.operation.parameters as ParameterObject[] | undefined) ?? []
  const allParams = [...pathParams, ...opParams]

  for (const p of allParams) {
    if (seen.has(p.name))
      continue
    seen.add(p.name)
    const rawSchema = p.schema ?? {}
    const schema = doc ? (resolveSchema(rawSchema, doc) ?? rawSchema) : rawSchema
    const decl = schemaToParamDeclaration(p.name, schema, p.required)
    if (p.description)
      decl.description = p.description
    decl.in = p.in
    params.push(decl)
  }

  const body = op.operation.requestBody as { description?: string, content?: Record<string, { schema?: OpenApiSchema }> } | undefined
  const jsonContent = body?.content?.['application/json']
  if (jsonContent?.schema) {
    if (!seen.has('body')) {
      seen.add('body')
      const rawBodySchema = jsonContent.schema
      const bodySchema = doc ? (resolveSchema(rawBodySchema, doc) ?? rawBodySchema) : rawBodySchema
      const bodyDecl = schemaToParamDeclaration('body', bodySchema, false)
      if (body?.description)
        bodyDecl.description = body.description
      bodyDecl.in = 'body'
      params.push(bodyDecl)
    }
  }

  return params
}
