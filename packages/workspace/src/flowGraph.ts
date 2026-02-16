import type { FlowDefinition, FlowGraph, FlowGraphEdge, FlowGraphEdgeKind, FlowGraphNodeShape } from '@runflow/core'
import { flowDefinitionToGraph, normalizeStepIds } from '@runflow/core'

/**
 * Collect edges from loop "connect" and "end" steps back to the loop step for visualization.
 * Merges both connect and end (same as loop handler getAllowedDependentIds) so no connect node is missed.
 * Only includes edges where both endpoints are in nodeIds. Marked as kind 'loopBack'.
 */
function getLoopBackEdges(flow: FlowDefinition, nodeIds: Set<string>): FlowGraphEdge[] {
  const edges: FlowGraphEdge[] = []
  for (const step of flow.steps) {
    if (step.type !== 'loop')
      continue
    const connectIds = [...new Set([
      ...normalizeStepIds(step.connect),
      ...normalizeStepIds(step.end),
    ])]
    for (const fromId of connectIds) {
      if (nodeIds.has(fromId) && nodeIds.has(step.id))
        edges.push({ source: fromId, target: step.id, kind: 'loopBack' })
    }
  }
  return edges
}

/** Assign kind for an edge (done / then / else) from flow step metadata. */
function getEdgeKind(edge: FlowGraphEdge, flow: FlowDefinition): FlowGraphEdgeKind | undefined {
  const step = flow.steps.find(s => s.id === edge.source)
  if (!step)
    return undefined
  if (step.type === 'loop') {
    const doneIds = normalizeStepIds(step.done)
    if (doneIds.includes(edge.target))
      return 'done'
  }
  if (step.type === 'condition') {
    const thenIds = normalizeStepIds(step.then)
    const elseIds = normalizeStepIds(step.else)
    if (thenIds.includes(edge.target))
      return 'then'
    if (elseIds.includes(edge.target))
      return 'else'
  }
  return undefined
}

function nodeShape(
  node: { id: string, type?: string },
  dagEdges: FlowGraphEdge[],
): FlowGraphNodeShape {
  if (node.type === 'condition')
    return 'decision'
  const inDegree = dagEdges.filter(e => e.target === node.id).length
  const outDegree = dagEdges.filter(e => e.source === node.id).length
  if (inDegree === 0)
    return 'start'
  if (outDegree === 0)
    return 'end'
  return 'process'
}

/**
 * Build flow graph including loop back edges and edge kinds (loopBack, done, then, else) for visualization.
 * Node shape: condition → decision (diamond), no incoming edge → start (stadium), no outgoing edge → end (stadium), else process (rect).
 */
export function flowDefinitionToGraphForVisualization(flow: FlowDefinition): FlowGraph {
  const graph = flowDefinitionToGraph(flow)
  const nodeIds = new Set(graph.nodes.map(n => n.id))
  const loopBackEdges = getLoopBackEdges(flow, nodeIds)
  const dagEdgesWithKind: FlowGraphEdge[] = graph.edges.map((e) => {
    const kind = getEdgeKind(e, flow)
    return kind ? { ...e, kind } : e
  })
  const connectSourceIds = new Set(loopBackEdges.map(e => e.source))
  const nodes = graph.nodes.map((n) => {
    let shape = nodeShape(n, dagEdgesWithKind)
    if (shape === 'end' && connectSourceIds.has(n.id))
      shape = 'process'
    return { ...n, shape }
  })
  return {
    ...graph,
    nodes,
    edges: [...dagEdgesWithKind, ...loopBackEdges],
  }
}
