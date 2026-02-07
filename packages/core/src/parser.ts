import type { FlowDefinition, FlowStep, FlowStepHttp, ParamDeclaration } from './types'
import { parse as parseYaml } from 'yaml'
import { STEP_TYPE_COMMAND, STEP_TYPE_HTTP, STEP_TYPE_JS } from './constants'
import { isParamType } from './paramsSchema'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseParamDeclaration(raw: unknown): ParamDeclaration | null {
  if (!isRecord(raw) || typeof raw.name !== 'string' || typeof raw.type !== 'string')
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
  if (raw.type === 'object' && isRecord(raw.schema)) {
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

function parseHeaders(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw))
    return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== 'string')
      return null
    out[k] = v
  }
  return out
}

function parseStep(raw: unknown): FlowStep | null {
  if (!isRecord(raw))
    return null
  const { id, type, run, file, url, method, headers, body, output, allowErrorStatus } = raw
  if (typeof id !== 'string' || typeof type !== 'string')
    return null
  if (type === STEP_TYPE_COMMAND) {
    if (typeof run !== 'string')
      return null
    return { id, type: 'command', run }
  }
  if (type === STEP_TYPE_JS) {
    const hasFile = typeof file === 'string'
    const hasRun = typeof run === 'string'
    if (hasFile) {
      if (file.endsWith('.ts'))
        return null
      return { id, type: 'js', run: hasRun ? run : '', file }
    }
    if (hasRun)
      return { id, type: 'js', run }
    return null
  }
  if (type === STEP_TYPE_HTTP) {
    if (typeof url !== 'string')
      return null
    const step: FlowStepHttp = { id, type: 'http', url }
    if (typeof method === 'string')
      step.method = method
    const parsedHeaders = headers !== undefined ? parseHeaders(headers) : null
    if (headers !== undefined && parsedHeaders === null)
      return null
    if (parsedHeaders)
      step.headers = parsedHeaders
    if (typeof body === 'string')
      step.body = body
    if (typeof output === 'string')
      step.output = output
    if (typeof allowErrorStatus === 'boolean')
      step.allowErrorStatus = allowErrorStatus
    return step
  }
  return null
}

export function parse(yamlContent: string): FlowDefinition | null {
  let parsed: unknown
  try {
    parsed = parseYaml(yamlContent)
  }
  catch {
    return null
  }
  if (!isRecord(parsed))
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
