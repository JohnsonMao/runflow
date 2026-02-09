import type { ParamDeclaration } from '@runflow/core'
import type { CollectedOperation } from './collectOperations.js'
import type { OpenApiSchema, ParameterObject } from './types.js'

type FlowParamType = ParamDeclaration['type']

function schemaTypeToParamType(schema?: OpenApiSchema): FlowParamType {
  if (!schema?.type)
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

export function mapParamsToDeclarations(op: CollectedOperation): ParamDeclaration[] {
  const params: ParamDeclaration[] = []
  const seen = new Set<string>()

  const pathParams = (op.pathItem.parameters as ParameterObject[] | undefined) ?? []
  const opParams = (op.operation.parameters as ParameterObject[] | undefined) ?? []
  const allParams = [...pathParams, ...opParams]

  for (const p of allParams) {
    if (seen.has(p.name))
      continue
    seen.add(p.name)
    const decl = schemaToParamDeclaration(p.name, p.schema ?? {}, p.required)
    if (p.description)
      decl.description = p.description
    params.push(decl)
  }

  const body = op.operation.requestBody as { description?: string, content?: Record<string, { schema?: OpenApiSchema }> } | undefined
  const jsonContent = body?.content?.['application/json']
  if (jsonContent?.schema) {
    if (!seen.has('body')) {
      seen.add('body')
      const bodyDecl = schemaToParamDeclaration('body', jsonContent.schema, false)
      if (body?.description)
        bodyDecl.description = body.description
      params.push(bodyDecl)
    }
  }

  return params
}
