import type { FlowDefinition, FlowStep } from './types'
import { buildDAG } from './dag'

/** Node shape for visualization: process (rect), decision (diamond), start/end (stadium), loop (rect). */
export type FlowGraphNodeShape = 'process' | 'decision' | 'start' | 'end' | 'loop'

/** Node in a flow graph (flow-graph-format). */
export interface FlowGraphNode {
  id: string
  type?: string
  label?: string
  /** When set, used for Mermaid/viewer shape (process=rect, decision=diamond, start/end=stadium). */
  shape?: FlowGraphNodeShape
}

/** Edge kind for visualization: loop back (connect→loop), done (loop→done), then/else (condition branches). */
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

function stepById(flow: FlowDefinition): Map<string, FlowStep> {
  const map = new Map<string, FlowStep>()
  for (const step of flow.steps)
    map.set(step.id, step)
  return map
}

/**
 * Build a flow graph from a FlowDefinition. Only steps with dependsOn are included (orphans excluded).
 * Edges: source = dependency, target = step that depends on it.
 */
export function flowDefinitionToGraph(flow: FlowDefinition): FlowGraph {
  const idToDepIds = buildDAG(flow.steps)
  const stepMap = stepById(flow)
  const nodes: FlowGraphNode[] = []
  const edges: FlowGraphEdge[] = []

  for (const [stepId, deps] of idToDepIds) {
    const step = stepMap.get(stepId)
    const type = step && typeof step.type === 'string' ? step.type : undefined
    const label = type ? `${stepId} (${type})` : stepId
    nodes.push({ id: stepId, type, label })
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
 * Serialize a flow graph to Mermaid flowchart TB. Nodes by id with optional label (id or "id (type)"); edges dependency → dependent.
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

/** Plain object for JSON output (flow-graph-format). */
export interface FlowGraphJson {
  nodes: FlowGraphNode[]
  edges: FlowGraphEdge[]
  flowName?: string
  flowDescription?: string
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
