import type { FlowDefinition, FlowStep } from '@runflow/core'
import type { OperationHooks, StepDef } from './types.js'

function ensureStepId(step: StepDef, prefix: string, index: number): FlowStep {
  const id = step.id ?? `${prefix}_${index}`
  const { id: _omit, ...rest } = step
  return { id, ...rest } as FlowStep
}

/**
 * Insert before/after steps around the API step. Order: [before] -> [api] -> [after].
 * Uses dependsOn only; no before/after fields on steps.
 * Auto-generates ids for hook steps when not provided (prefix with operation key).
 */
export function applyHooks(
  flow: FlowDefinition,
  operationKey: string,
  hooks: OperationHooks,
): FlowDefinition {
  const safeKey = operationKey.replace(/-/g, '_')
  const apiStep = flow.steps.find(s => s.type === 'http')
  if (!apiStep)
    return flow

  const beforeSteps: FlowStep[] = (hooks.before ?? []).map((s, i) => {
    const step = ensureStepId(s, `${safeKey}_before`, i)
    const userDependsOn = (s as { dependsOn?: string[] }).dependsOn
    return { ...step, dependsOn: userDependsOn ?? [] } as FlowStep
  })
  const afterSteps: FlowStep[] = (hooks.after ?? []).map((s, i) => {
    const step = ensureStepId(s, `${safeKey}_after`, i)
    const userDependsOn = (s as { dependsOn?: string[] }).dependsOn ?? []
    const merged = [...new Set([...userDependsOn, apiStep.id])]
    return { ...step, dependsOn: merged } as FlowStep
  })

  const beforeIds = beforeSteps.map(s => s.id)

  const apiWithDependsOn: FlowStep = {
    ...apiStep,
    dependsOn: beforeIds.length > 0 ? beforeIds : apiStep.dependsOn,
  }

  const steps = [...beforeSteps, apiWithDependsOn, ...afterSteps]
  return { ...flow, steps }
}
