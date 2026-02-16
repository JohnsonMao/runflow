/** Edge kind for visualization (loop back, done, then, else). */
export type FlowGraphEdgeKind = 'dependsOn' | 'loopBack' | 'done' | 'then' | 'else'

/** Node shape for visualization: process (rect), decision (diamond), start/end (stadium), loop. */
export type FlowGraphNodeShape = 'process' | 'decision' | 'start' | 'end' | 'loop'

/** Flow graph format (from flow view --output json). */
export interface FlowGraphInput {
  nodes: { id: string, type?: string, label?: string, shape?: FlowGraphNodeShape }[]
  edges: { source: string, target: string, kind?: FlowGraphEdgeKind }[]
  flowName?: string
  flowDescription?: string
}
