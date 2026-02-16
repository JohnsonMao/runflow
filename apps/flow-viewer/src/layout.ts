import type { FlowGraphInput, FlowGraphInputEdge } from './types'
import dagre from 'dagre'

const RANK_SEP = 72
const NODE_SEP = 64

/** Default height for single-line node (py-2 + text). */
const NODE_HEIGHT = 44

const MIN_NODE_WIDTH = 80 // min-w-20 = 5rem
const H_PADDING = 28 // px-3.5 * 2
const APPROX_CHAR_WIDTH = 7

/**
 * Compute node width from label length so layout matches rendered size (no max cap).
 */
function nodeWidth(label: string | undefined): number {
  const contentW = (label?.length ?? 0) * APPROX_CHAR_WIDTH
  return Math.max(MIN_NODE_WIDTH, H_PADDING + contentW)
}

function nodeDimensions(label: string | undefined): { width: number, height: number } {
  return {
    width: nodeWidth(label),
    height: NODE_HEIGHT,
  }
}

/** DAG edges only (exclude loopBack) so dagre gets acyclic graph. */
function dagEdges(edges: FlowGraphInputEdge[]): FlowGraphInputEdge[] {
  return edges.filter(e => e.kind !== 'loopBack')
}

/** Order DAG edges so else-branch is added before then-branch; dagre often orders same-rank nodes by edge order. */
function orderedDagEdges(edges: FlowGraphInputEdge[]): FlowGraphInputEdge[] {
  const dag = dagEdges(edges)
  const elseFirst = (a: FlowGraphInputEdge, b: FlowGraphInputEdge) => {
    if (a.kind === 'else' && b.kind === 'then')
      return -1
    if (a.kind === 'then' && b.kind === 'else')
      return 1
    return 0
  }
  return [...dag].sort(elseFirst)
}

/**
 * Layout with dagre (hierarchical, top-down). See React Flow layouting:
 * https://reactflow.dev/learn/layouting/layouting
 * Uses only DAG edges so loop-back does not break layout.
 * Edges are ordered so else-branch nodes tend to appear left of then-branch nodes.
 * Node width/height are computed from shape and label so layout matches rendered content.
 * Returns node id -> top-left position for React Flow.
 *
 * @param graph - Flow graph (nodes may have optional label for width calculation)
 */
export function layoutGraph(graph: FlowGraphInput): Map<string, { x: number, y: number }> {
  const { nodes, edges } = graph
  const dag = orderedDagEdges(edges)
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
    const { width, height } = nodeDimensions(node.label)
    g.setNode(node.id, { width, height })
  }
  for (const e of dag) {
    if (nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target))
      g.setEdge(e.source, e.target)
  }
  dagre.layout(g)
  const positions = new Map<string, { x: number, y: number }>()
  for (const node of nodes) {
    const n = g.node(node.id)
    const { width: w, height: h } = nodeDimensions(node.label)
    if (n) {
      positions.set(node.id, {
        x: n.x - (n.width ?? w) / 2,
        y: n.y - (n.height ?? h) / 2,
      })
    }
    else {
      positions.set(node.id, { x: 0, y: 0 })
    }
  }
  // Dagre does not enforce same-rank order: ensure else-branch is left of then-branch (smaller x)
  applyElseLeftThenRight(positions, dag)
  return positions
}

/** Swap x of else/then targets when they are in the same rank and else is to the right of then. */
function applyElseLeftThenRight(
  positions: Map<string, { x: number, y: number }>,
  edges: FlowGraphInputEdge[],
): void {
  const sameRankTolerance = 2
  const bySource = new Map<string, { elseTarget?: string, thenTarget?: string }>()
  for (const e of edges) {
    if (e.kind !== 'else' && e.kind !== 'then')
      continue
    let entry = bySource.get(e.source)
    if (!entry) {
      entry = {}
      bySource.set(e.source, entry)
    }
    if (e.kind === 'else')
      entry.elseTarget = e.target
    else
      entry.thenTarget = e.target
  }
  for (const [, entry] of bySource) {
    const elseId = entry.elseTarget
    const thenId = entry.thenTarget
    if (!elseId || !thenId)
      continue
    const pe = positions.get(elseId)
    const pt = positions.get(thenId)
    if (!pe || !pt)
      continue
    const sameRank = Math.abs(pe.y - pt.y) <= sameRankTolerance
    if (sameRank && pe.x > pt.x) {
      const tmp = pe.x
      pe.x = pt.x
      pt.x = tmp
    }
  }
}
