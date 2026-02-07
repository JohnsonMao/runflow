import type { FlowDefinition, FlowStep } from './types'
import { parse as parseYaml } from 'yaml'
import { STEP_TYPE_COMMAND, STEP_TYPE_JS } from './constants'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseStep(raw: unknown): FlowStep | null {
  if (!isRecord(raw))
    return null
  const { id, type, run } = raw
  if (typeof id !== 'string' || typeof type !== 'string')
    return null
  if (type === STEP_TYPE_COMMAND) {
    if (typeof run !== 'string')
      return null
    return { id, type: 'command', run }
  }
  if (type === STEP_TYPE_JS) {
    if (typeof run !== 'string')
      return null
    return { id, type: 'js', run }
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
  const { name, description, steps } = parsed
  if (typeof name !== 'string')
    return null
  if (!Array.isArray(steps))
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
    steps: parsedSteps,
  }
}
