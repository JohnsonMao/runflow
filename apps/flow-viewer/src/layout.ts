import type { FlowGraphInput } from './types'
import dagre from 'dagre'

const NODE_WIDTH = 160
const NODE_HEIGHT = 44
const RANK_SEP = 72
const NODE_SEP = 64

/** DAG edges only (exclude loopBack) so dagre gets acyclic graph. */
function dagEdges(edges: FlowGraphInput['edges']): FlowGraphInput['edges'] {
  return edges.filter(e => e.kind !== 'loopBack')
}

/**
 * Layout with dagre (hierarchical, top-down). Uses only DAG edges so loop-back does not break layout.
 * Returns node id -> top-left position for React Flow.
 */
export function layoutGraph(graph: FlowGraphInput): Map<string, { x: number, y: number }> {
  const { nodes, edges } = graph
  const dag = dagEdges(edges)
  const g = new dagre.graphlib.Graph({ compound: true })
  g.setGraph({
    rankdir: 'TB',
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 40,
    marginy: 40,
  })
  g.setDefaultEdgeLabel(() => ({}))
  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const e of dag) {
    if (nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target))
      g.setEdge(e.source, e.target)
  }
  dagre.layout(g)
  const positions = new Map<string, { x: number, y: number }>()
  for (const node of nodes) {
    const n = g.node(node.id)
    if (n) {
      positions.set(node.id, {
        x: n.x - (n.width ?? NODE_WIDTH) / 2,
        y: n.y - (n.height ?? NODE_HEIGHT) / 2,
      })
    }
    else {
      positions.set(node.id, { x: 0, y: 0 })
    }
  }
  return positions
}
