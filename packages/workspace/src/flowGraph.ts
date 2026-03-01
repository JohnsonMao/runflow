import type { FlowDefinition, FlowStep } from '@runflow/core'
import { normalizeStepIds } from '@runflow/core'

/** Node shape for visualization: process (rect), decision (diamond), start/end (stadium), loop (rect). */
export type FlowGraphNodeShape = 'process' | 'decision' | 'start' | 'end' | 'loop'

/** Node in a flow graph (flow-graph-format). */
export interface FlowGraphNode {
  id: string
  type?: string
  label?: string
  /** Optional description from step for tooltips or detail views. */
  description?: string
  /** When set, used for Mermaid/viewer shape (process=rect, decision=diamond, start/end=stadium). */
  shape?: FlowGraphNodeShape
}

/** Edge kind for visualization: loop back (iterationCompleteSignals→loop), done (loop→done), then/else (condition branches). */
export type FlowGraphEdgeKind = 'dependsOn' | 'loopBack' | 'done' | 'then' | 'else'

/** Directed edge: source is dependency of target (target has source in dependsOn). Optional kind for styling/labels. */
export interface FlowGraphEdge {
  source: string
  target: string
  /** When set, distinguishes loop back, done, then, else for visualization. */
  kind?: FlowGraphEdgeKind
}

/** Flow graph for visualization (flow-graph-format). */
export interface FlowGraph {
  nodes: FlowGraphNode[]
  edges: FlowGraphEdge[]
  flowName?: string
  flowDescription?: string
}

/** Plain object for JSON output (flow-graph-format). */
export interface FlowGraphJson {
  nodes: FlowGraphNode[]
  edges: FlowGraphEdge[]
  flowName?: string
  flowDescription?: string
}

/** Build DAG from steps that have dependsOn (for graph only). */
function buildDAGForGraph(steps: FlowStep[]): Map<string, string[]> {
  const idToDepIds = new Map<string, string[]>()
  for (const step of steps) {
    if (step.dependsOn == null || !Array.isArray(step.dependsOn))
      continue
    idToDepIds.set(step.id, [...step.dependsOn])
  }
  return idToDepIds
}

function stepByIdForGraph(flow: FlowDefinition): Map<string, FlowStep> {
  const m = new Map<string, FlowStep>()
  for (const s of flow.steps)
    m.set(s.id, s)
  return m
}

/**
 * Build a flow graph from a FlowDefinition. Only steps with dependsOn are included (orphans excluded).
 * Edges: source = dependency, target = step that depends on it.
 */
export function flowDefinitionToGraph(flow: FlowDefinition): FlowGraph {
  const idToDepIds = buildDAGForGraph(flow.steps)
  const stepMap = stepByIdForGraph(flow)
  const nodes: FlowGraphNode[] = []
  const edges: FlowGraphEdge[] = []

  for (const [stepId, deps] of idToDepIds) {
    const step = stepMap.get(stepId)
    const type = step && typeof step.type === 'string' ? step.type : undefined
    const labelFallback = type ? `${stepId} (${type})` : stepId
    const label = step && typeof step.name === 'string' && step.name !== ''
      ? step.name
      : labelFallback
    const node: FlowGraphNode = { id: stepId, type, label }
    if (step && typeof step.description === 'string')
      node.description = step.description
    nodes.push(node)
    for (const dep of deps)
      edges.push({ source: dep, target: stepId })
  }

  return {
    nodes,
    edges,
    flowName: flow.name,
    flowDescription: flow.description,
  }
}

/** Escape a string for use inside Mermaid node label (double-quote and backslash). */
function mermaidEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** Sanitize to a Mermaid-safe node id (unquoted identifier: alphanumeric + underscore). */
function mermaidSafeId(id: string): string {
  return id.replace(/\W/g, '_')
}

/** Build unique Mermaid node ids; collisions get _2, _3 suffix. */
function uniqueMermaidIds(nodeIds: string[]): Map<string, string> {
  const idToSafe = new Map<string, string>()
  const used = new Map<string, string>()
  for (const id of nodeIds) {
    let safe = mermaidSafeId(id)
    if (safe === '')
      safe = 'n'
    let key = safe
    let n = 1
    while (used.has(key)) {
      n++
      key = `${safe}_${n}`
    }
    used.set(key, id)
    idToSafe.set(id, key)
  }
  return idToSafe
}

/**
 * Serialize a flow graph to Mermaid flowchart TB. Nodes by id with optional label; edges dependency → dependent.
 * Node ids are sanitized to unquoted identifiers so the parser accepts them.
 */
export function flowGraphToMermaid(graph: FlowGraph): string {
  const nodeIds = graph.nodes.map(n => n.id)
  const idToSafe = uniqueMermaidIds(nodeIds)
  const lines: string[] = ['flowchart TB']
  for (const node of graph.nodes) {
    const safeId = idToSafe.get(node.id) ?? (mermaidSafeId(node.id) || 'n')
    const label = mermaidEscape(node.label ?? node.id)
    switch (node.shape) {
      case 'decision':
        lines.push(`  ${safeId}{"${label}"}`)
        break
      case 'start':
      case 'end':
        lines.push(`  ${safeId}(["${label}"])`)
        break
      case 'loop':
      default:
        lines.push(`  ${safeId}["${label}"]`)
    }
  }
  const kindToLabel: Record<Exclude<FlowGraphEdgeKind, 'dependsOn'>, string> = {
    loopBack: 'loop',
    done: 'done',
    then: 'then',
    else: 'else',
  }
  for (const edge of graph.edges) {
    const src = idToSafe.get(edge.source) ?? (mermaidSafeId(edge.source) || 'n')
    const tgt = idToSafe.get(edge.target) ?? (mermaidSafeId(edge.target) || 'n')
    const linkLabel = edge.kind && edge.kind !== 'dependsOn' ? kindToLabel[edge.kind] : undefined
    const labelEscaped = linkLabel ? mermaidEscape(linkLabel) : ''
    if (labelEscaped)
      lines.push(`  ${src} -->|${labelEscaped}| ${tgt}`)
    else
      lines.push(`  ${src} --> ${tgt}`)
  }
  return lines.join('\n')
}

/**
 * Convert flow graph to a plain object for JSON.stringify (flow-graph-format).
 */
export function flowGraphToJson(graph: FlowGraph): FlowGraphJson {
  const out: FlowGraphJson = { nodes: graph.nodes, edges: graph.edges }
  if (graph.flowName != null)
    out.flowName = graph.flowName
  if (graph.flowDescription != null)
    out.flowDescription = graph.flowDescription
  return out
}

// --- flowDefinitionToGraphForVisualization (enriched with loop back edges, edge kinds, node shape) ---

/**
 * Collect edges from loop "iterationCompleteSignals" and "end" steps back to the loop step for visualization.
 * Only includes edges where both endpoints are in nodeIds. Marked as kind 'loopBack'.
 */
function getLoopBackEdges(flow: FlowDefinition, nodeIds: Set<string>): FlowGraphEdge[] {
  const edges: FlowGraphEdge[] = []
  for (const step of flow.steps) {
    if (step.type !== 'loop')
      continue
    const signalIds = [...new Set([
      ...normalizeStepIds(step.iterationCompleteSignals),
      ...normalizeStepIds(step.end),
    ])]
    for (const fromId of signalIds) {
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

/** Derive node shape for CLI (mermaid) and view. */
function nodeShape(
  node: { id: string, type?: string },
  dagEdges: FlowGraphEdge[],
  signalSourceIds: Set<string>,
): FlowGraphNodeShape {
  if (node.type === 'condition')
    return 'decision'
  if (node.type === 'loop')
    return 'loop'
  const inDegree = dagEdges.filter(e => e.target === node.id).length
  const outDegree = dagEdges.filter(e => e.source === node.id).length
  if (inDegree === 0)
    return 'start'
  if (outDegree === 0) {
    if (signalSourceIds.has(node.id))
      return 'process'
    return 'end'
  }
  return 'process'
}

/**
 * Build flow graph including loop back edges, edge kinds (loopBack, done, then, else), and node shape.
 * Shape is set here so both CLI (mermaid) and flow-viewer get a consistent graph.
 */
export function flowDefinitionToGraphForVisualization(flow: FlowDefinition): FlowGraph {
  const graph = flowDefinitionToGraph(flow)
  const nodeIds = new Set(graph.nodes.map(n => n.id))
  const loopBackEdges = getLoopBackEdges(flow, nodeIds)
  const dagEdgesWithKind: FlowGraphEdge[] = graph.edges.map((e) => {
    const kind = getEdgeKind(e, flow)
    return kind ? { ...e, kind } : e
  })
  const signalSourceIds = new Set(loopBackEdges.map(e => e.source))
  const nodes = graph.nodes.map(n => ({
    ...n,
    shape: nodeShape(n, dagEdgesWithKind, signalSourceIds),
  }))
  return {
    ...graph,
    nodes,
    edges: [...dagEdgesWithKind, ...loopBackEdges],
  }
}
