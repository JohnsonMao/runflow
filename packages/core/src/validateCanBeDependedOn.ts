import type { FlowDefinition, StepRegistry } from './types'
import { getDAGStepIds } from './dag'

/**
 * Validates that for each step whose handler implements getAllowedDependentIds,
 * only steps returned by that handler's getAllowedDependentIds(step) have dependsOn pointing to it.
 * Core does not interpret step.type or step shape; the handler provides the allowed set.
 * Returns an error message including violating step id(s), or null if valid.
 */
export function validateCanBeDependedOn(
  flow: FlowDefinition,
  registry: StepRegistry,
): string | null {
  const dagIds = getDAGStepIds(flow.steps)
  for (const step of flow.steps) {
    if (!dagIds.has(step.id))
      continue
    const handler = registry[step.type]
    const getIds = handler?.flowControl?.getAllowedDependentIds
    if (typeof getIds === 'function') {
      const allowedIds = new Set(getIds(step))
      const violating: string[] = []
      for (const s of flow.steps) {
        if (!Array.isArray(s.dependsOn))
          continue
        if (!s.dependsOn.includes(step.id))
          continue
        if (!allowedIds.has(s.id))
          violating.push(s.id)
      }
      if (violating.length > 0) {
        const allowedList = [...allowedIds].sort().join(', ')
        return `Step "${step.id}" allows only dependents [${allowedList}]; step(s) ${violating.map(id => `"${id}"`).join(', ')} have dependsOn: [${step.id}].`
      }
    }
  }
  return null
}
