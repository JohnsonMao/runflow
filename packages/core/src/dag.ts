import type { FlowStep } from './types'

export type DAGResult = { ok: true, order: string[] } | { ok: false, error: string }

/**
 * Build DAG from all steps. Steps with no `dependsOn` or non-array `dependsOn` are treated as roots (empty deps).
 */
export function buildDAG(steps: FlowStep[]): Map<string, string[]> {
  const idToDepIds = new Map<string, string[]>()
  for (const step of steps) {
    idToDepIds.set(step.id, Array.isArray(step.dependsOn) ? [...step.dependsOn] : [])
  }
  return idToDepIds
}

/**
 * Get set of all step ids (used for DAG validation and order).
 */
export function getDAGStepIds(steps: FlowStep[]): Set<string> {
  return new Set(steps.map(s => s.id))
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
