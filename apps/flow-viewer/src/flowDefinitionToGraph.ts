import type { FlowGraphEdgeKind, FlowGraphInput, FlowGraphNodeShape } from './types'

function normalizeStepIds(v: unknown): string[] {
  if (typeof v === 'string')
    return [v]
  if (Array.isArray(v))
    return v.filter((x): x is string => typeof x === 'string')
  return []
}

/** Minimal FlowDefinition shape for browser (no Node deps). */
export interface FlowDefinitionInput {
  name: string
  description?: string
  steps: Array<{
    id: string
    type?: string
    dependsOn?: string[]
    connect?: string | string[]
    end?: string | string[]
    done?: string | string[]
    then?: string | string[]
    else?: string | string[]
  }>
}

function nodeShape(
  node: { id: string, type?: string, label?: string },
  dagEdges: FlowGraphInput['edges'],
  connectSourceIds?: Set<string>,
): FlowGraphNodeShape {
  const isCondition = node.type === 'condition'
    || (typeof node.label === 'string' && node.label.includes('(condition)'))
  if (isCondition)
    return 'decision'
  const inDegree = dagEdges.filter(e => e.target === node.id).length
  const outDegree = dagEdges.filter(e => e.source === node.id).length
  if (inDegree === 0)
    return 'start'
  if (outDegree === 0) {
    if (connectSourceIds?.has(node.id))
      return 'process'
    return 'end'
  }
  return 'process'
}

/**
 * Fill missing node shape from graph structure and node type/label. Use after parsing graph JSON that may lack shape.
 */
export function ensureNodeShapes(graph: FlowGraphInput): FlowGraphInput {
  const dag = graph.edges.filter(e => e.kind !== 'loopBack')
  const connectSourceIds = new Set(
    graph.edges.filter(e => e.kind === 'loopBack').map(e => e.source),
  )
  const nodes = graph.nodes.map(n => ({
    ...n,
    shape: n.shape ?? nodeShape(n, dag, connectSourceIds),
  }))
  return { ...graph, nodes }
}

/**
 * Derive flow graph from FlowDefinition (same semantics as flow-graph-format).
 * Only steps with dependsOn are included. Node shape: condition → decision, no incoming → start, no outgoing → end, else process.
 */
export function flowDefinitionToGraph(flow: FlowDefinitionInput): FlowGraphInput {
  const nodes: FlowGraphInput['nodes'] = []
  const edges: FlowGraphInput['edges'] = []
  const idToDeps = new Map<string, string[]>()
  for (const step of flow.steps) {
    if (step.dependsOn == null || !Array.isArray(step.dependsOn))
      continue
    idToDeps.set(step.id, [...step.dependsOn])
  }
  const dagIds = new Set(idToDeps.keys())
  const stepById = new Map(flow.steps.map(s => [s.id, s]))
  for (const [stepId, deps] of idToDeps) {
    const step = stepById.get(stepId)
    const type = step && typeof step.type === 'string' ? step.type : undefined
    const label = type ? `${stepId} (${type})` : stepId
    nodes.push({ id: stepId, type, label })
    for (const dep of deps) {
      if (!dagIds.has(dep))
        continue
      const sourceStep = stepById.get(dep)
      let kind: FlowGraphEdgeKind | undefined
      if (sourceStep?.type === 'loop' && normalizeStepIds(sourceStep.done).includes(stepId)) {
        kind = 'done'
      }
      else if (sourceStep?.type === 'condition') {
        if (normalizeStepIds(sourceStep.then).includes(stepId))
          kind = 'then'
        else if (normalizeStepIds(sourceStep.else).includes(stepId))
          kind = 'else'
      }
      edges.push(kind ? { source: dep, target: stepId, kind } : { source: dep, target: stepId })
    }
  }
  const nodeIdSet = new Set(nodes.map(n => n.id))
  const connectSourceIds = new Set<string>()
  for (const step of flow.steps) {
    if (step.type !== 'loop')
      continue
    const connectIds = normalizeStepIds(step.connect ?? step.end)
    for (const fromId of connectIds) {
      if (nodeIdSet.has(fromId) && nodeIdSet.has(step.id)) {
        connectSourceIds.add(fromId)
        edges.push({ source: fromId, target: step.id, kind: 'loopBack' })
      }
    }
  }
  const nodesWithShape = nodes.map(n => ({
    ...n,
    shape: nodeShape(n, edges.filter(e => e.kind !== 'loopBack'), connectSourceIds),
  }))
  return {
    nodes: nodesWithShape,
    edges,
    flowName: flow.name,
    flowDescription: flow.description,
  }
}
