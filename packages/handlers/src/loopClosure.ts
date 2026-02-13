import type { FlowStep } from '@runflow/core'

/**
 * Compute the forward transitive closure from entry step ids for a loop.
 * Scope starts with entryIds; repeatedly add step S if every id in S.dependsOn
 * is either loopStepId or already in scope. Only steps present in `steps` are added.
 */
export function computeLoopClosure(
  steps: FlowStep[],
  entryIds: string[],
  loopStepId: string,
): string[] {
  const stepById = new Map(steps.map(s => [s.id, s]))
  const scope = new Set<string>(entryIds.filter(id => stepById.has(id)))

  let changed = true
  while (changed) {
    changed = false
    for (const step of steps) {
      if (scope.has(step.id))
        continue
      const deps = step.dependsOn
      if (!Array.isArray(deps) || deps.length === 0)
        continue
      const allInScope = deps.every(dep => dep === loopStepId || scope.has(dep))
      if (allInScope) {
        scope.add(step.id)
        changed = true
      }
    }
  }

  return [...scope]
}

/**
 * Return step ids in closure that are sinks: no other step in closure depends on them.
 */
export function inferLoopEndSinks(steps: FlowStep[], closureIds: string[]): string[] {
  const closureSet = new Set(closureIds)
  const dependedOnBy = new Set<string>()
  for (const step of steps) {
    if (!closureSet.has(step.id))
      continue
    const deps = step.dependsOn
    if (!Array.isArray(deps))
      continue
    for (const dep of deps) {
      if (closureSet.has(dep))
        dependedOnBy.add(dep)
    }
  }
  return closureIds.filter(id => !dependedOnBy.has(id))
}
