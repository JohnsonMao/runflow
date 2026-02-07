import type { FlowDefinition, FlowStep, ParamDeclaration } from './types'
import { parse as parseYaml } from 'yaml'
import { isParamType } from './paramsSchema'
import { isPlainObject } from './utils'

function parseParamDeclaration(raw: unknown): ParamDeclaration | null {
  if (!isPlainObject(raw) || typeof raw.name !== 'string' || typeof raw.type !== 'string')
    return null
  if (!isParamType(raw.type))
    return null
  const decl: ParamDeclaration = {
    name: raw.name,
    type: raw.type,
  }
  if (typeof raw.required === 'boolean')
    decl.required = raw.required
  if (raw.default !== undefined)
    decl.default = raw.default
  if (Array.isArray(raw.enum))
    decl.enum = raw.enum
  if (typeof raw.description === 'string')
    decl.description = raw.description
  if (raw.type === 'object' && isPlainObject(raw.schema)) {
    const schema: Record<string, ParamDeclaration> = {}
    for (const [k, v] of Object.entries(raw.schema)) {
      const nested = parseParamDeclaration(v)
      if (!nested)
        return null
      schema[k] = nested
    }
    decl.schema = schema
  }
  if (raw.type === 'array' && raw.items !== undefined) {
    const items = parseParamDeclaration(raw.items)
    if (!items)
      return null
    decl.items = items
  }
  return decl
}

function parseParams(raw: unknown): ParamDeclaration[] | null {
  if (!Array.isArray(raw))
    return null
  const out: ParamDeclaration[] = []
  for (const item of raw) {
    const decl = parseParamDeclaration(item)
    if (!decl)
      return null
    out.push(decl)
  }
  return out
}

function parseStep(raw: unknown): FlowStep | null {
  if (!isPlainObject(raw))
    return null
  const { id, type } = raw
  if (typeof id !== 'string' || typeof type !== 'string')
    return null
  const step: FlowStep = { id, type }
  for (const k of Object.keys(raw)) {
    if (k !== 'id' && k !== 'type')
      step[k] = raw[k]
  }
  return step
}

export function parse(yamlContent: string): FlowDefinition | null {
  let parsed: unknown
  try {
    parsed = parseYaml(yamlContent)
  }
  catch {
    return null
  }
  if (!isPlainObject(parsed))
    return null
  const { name, description, steps, params } = parsed
  if (typeof name !== 'string')
    return null
  if (!Array.isArray(steps))
    return null
  const parsedParams = params !== undefined ? parseParams(params) : undefined
  if (params !== undefined && parsedParams === null)
    return null
  const parsedSteps: FlowStep[] = []
  for (const raw of steps) {
    const step = parseStep(raw)
    if (!step)
      return null
    parsedSteps.push(step)
  }
  return {
    name,
    description: typeof description === 'string' ? description : undefined,
    params: parsedParams ?? undefined,
    steps: parsedSteps,
  }
}
