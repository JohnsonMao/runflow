import type { Edge, Node } from 'reactflow'
import type { FlowGraphInput, FlowGraphInputNode } from './types'
import { getNodeShape } from './flowDefinitionToGraph'
import { layoutGraph } from './layout'

export function nodeType(shape?: FlowGraphInputNode['shape']): string {
  if (shape === 'decision')
    return 'decision'
  if (shape === 'loop')
    return 'loop'
  if (shape === 'start' || shape === 'end')
    return 'startEnd'
  return 'process'
}

export function graphToReactFlow(graph: FlowGraphInput): { nodes: Node[], edges: Edge[] } {
  const dag = graph.edges.filter(e => e.kind !== 'loopBack')
  const connectSourceIds = new Set(
    graph.edges.filter(e => e.kind === 'loopBack').map(e => e.source),
  )
  const getShape = (n: FlowGraphInputNode) =>
    n.shape ?? getNodeShape(n, dag, connectSourceIds)
  const nodeShapes = new Map(graph.nodes.map(n => [n.id, getShape(n)]))

  const positions = layoutGraph(graph)
  const nodes: Node[] = graph.nodes.map((n, i) => {
    const shape = nodeShapes.get(n.id)!
    return {
      id: n.id,
      type: nodeType(shape),
      position: positions.get(n.id) ?? { x: 0, y: i * 60 },
      data: {
        label: n.label ?? (n.type ? `${n.id} (${n.type})` : n.id),
        ...(n.description ? { description: n.description } : {}),
        ...(shape ? { shape } : {}),
      },
    }
  })
  const edges: Edge[] = graph.edges.map((e, i) => {
    const sourceShape = nodeShapes.get(e.source)
    const targetShape = nodeShapes.get(e.target)
    const isFromDecision = sourceShape === 'decision'
    const isFromLoop = sourceShape === 'loop'
    const isToLoop = targetShape === 'loop'
    let sourceHandle: string | undefined
    let targetHandle: string | undefined
    if (isFromDecision && e.kind === 'then')
      sourceHandle = 'then'
    else if (isFromDecision && e.kind === 'else')
      sourceHandle = 'else'
    else if (isFromLoop && e.kind === 'done')
      sourceHandle = 'done'
    else if (isFromLoop)
      sourceHandle = 'out'
    else
      sourceHandle = undefined
    if (isToLoop)
      targetHandle = 'in'
    return {
      id: `e-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
      type: e.kind === 'loopBack' ? 'smoothstep' : 'default',
      className: e.kind === 'loopBack' ? 'flow-edge-loop-back' : undefined,
    }
  })
  return { nodes, edges }
}
