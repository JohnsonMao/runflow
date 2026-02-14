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
 * Compute backward closure: all step ids that are transitive dependencies of targetIds
 * (steps that must run before any of targetIds). Used with connect to define "one round".
 */
export function computeBackwardClosure(
  steps: FlowStep[],
  targetIds: string[],
): Set<string> {
  const stepById = new Map(steps.map(s => [s.id, s]))
  const scope = new Set(targetIds.filter(id => stepById.has(id)))
  let changed = true
  while (changed) {
    changed = false
    for (const id of scope) {
      const st = stepById.get(id)
      if (!st || !Array.isArray(st.dependsOn))
        continue
      for (const dep of st.dependsOn) {
        if (!scope.has(dep)) {
          scope.add(dep)
          changed = true
        }
      }
    }
  }
  return scope
}

/**
 * Return step ids that must be excluded from the loop body: done ids plus any step in closure
 * that (transitively) depends on a done step. Those run only after the loop returns nextSteps.
 */
export function closureIdsThatDependOnDone(
  steps: FlowStep[],
  closureIds: string[],
  doneIds: string[],
): Set<string> {
  const stepById = new Map(steps.map(s => [s.id, s]))
  const excluded = new Set(doneIds)
  let changed = true
  while (changed) {
    changed = false
    for (const id of closureIds) {
      if (excluded.has(id))
        continue
      const st = stepById.get(id)
      if (!st || !Array.isArray(st.dependsOn))
        continue
      if (st.dependsOn.some(dep => excluded.has(dep))) {
        excluded.add(id)
        changed = true
      }
    }
  }
  return excluded
}
