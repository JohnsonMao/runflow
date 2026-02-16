/** Edge kind for visualization (loop back, done, then, else). */
export type FlowGraphEdgeKind = 'dependsOn' | 'loopBack' | 'done' | 'then' | 'else'

/** Node shape for visualization: process (rect), decision (diamond), start/end (stadium), loop. */
export type FlowGraphNodeShape = 'process' | 'decision' | 'start' | 'end' | 'loop'

/** Single node in flow graph input (from flow view --output json). */
export interface FlowGraphInputNode {
  id: string
  type?: string
  label?: string
  description?: string
  shape?: FlowGraphNodeShape
}

/** Single edge in flow graph input. */
export interface FlowGraphInputEdge {
  source: string
  target: string
  kind?: FlowGraphEdgeKind
}

/** Flow graph format (from flow view --output json). */
export interface FlowGraphInput {
  nodes: FlowGraphInputNode[]
  edges: FlowGraphInputEdge[]
  flowName?: string
  flowDescription?: string
}
