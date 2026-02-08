import type { FlowStep } from './types'

export type DAGResult = { ok: true, order: string[] } | { ok: false, error: string }

/**
 * Build DAG from steps that have `dependsOn` (present and array).
 * Steps with no `dependsOn` field are excluded (orphans).
 * Steps with `dependsOn: []` are roots.
 */
export function buildDAG(steps: FlowStep[]): Map<string, string[]> {
  const idToDepIds = new Map<string, string[]>()
  const inGraph = new Set<string>()
  for (const step of steps) {
    if (step.dependsOn == null)
      continue
    if (!Array.isArray(step.dependsOn))
      continue
    inGraph.add(step.id)
    idToDepIds.set(step.id, [...step.dependsOn])
  }
  return idToDepIds
}

/**
 * Get set of step ids that are in the DAG (have dependsOn).
 */
export function getDAGStepIds(steps: FlowStep[]): Set<string> {
  const ids = new Set<string>()
  for (const step of steps) {
    if (step.dependsOn != null && Array.isArray(step.dependsOn))
      ids.add(step.id)
  }
  return ids
}

/**
 * Topological sort with cycle and missing-id detection.
 * Returns ordered step ids or an error message.
 */
export function topologicalSort(steps: FlowStep[]): DAGResult {
  const idToDepIds = buildDAG(steps)
  const dagIds = getDAGStepIds(steps)

  for (const [id, deps] of idToDepIds) {
    for (const dep of deps) {
      if (!dagIds.has(dep)) {
        return { ok: false, error: `Step "${id}" depends on "${dep}" which is not in the DAG (missing or orphan).` }
      }
    }
  }

  const order: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  function visit(id: string): boolean {
    if (visited.has(id))
      return true
    if (visiting.has(id))
      return false
    visiting.add(id)
    const deps = idToDepIds.get(id) ?? []
    for (const d of deps) {
      if (!visit(d))
        return false
    }
    visiting.delete(id)
    visited.add(id)
    order.push(id)
    return true
  }

  for (const id of idToDepIds.keys()) {
    if (!visit(id))
      return { ok: false, error: 'Cycle detected in dependsOn.' }
  }

  return { ok: true, order }
}

/**
 * Validate DAG: all dependencies in DAG, no cycle.
 * Returns error message or null if valid.
 */
export function validateDAG(steps: FlowStep[]): string | null {
  const r = topologicalSort(steps)
  return r.ok ? null : r.error
}
