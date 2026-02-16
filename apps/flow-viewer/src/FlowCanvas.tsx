import type { Edge, Node, NodeProps } from 'reactflow'
import type { FlowGraphInput } from './types'
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from 'reactflow'
import { layoutGraph } from './layout'

interface FlowCanvasProps {
  graph: FlowGraphInput
}

const EDGE_KIND_LABEL: Record<Exclude<FlowGraphInput['edges'][number]['kind'], undefined>, string> = {
  loopBack: 'loop',
  done: 'done',
  then: 'then',
  else: 'else',
  dependsOn: '',
}

function nodeType(shape?: FlowGraphInput['nodes'][number]['shape']): string {
  if (shape === 'decision')
    return 'decision'
  if (shape === 'start' || shape === 'end')
    return 'startEnd'
  return 'process'
}

function ProcessNode({ data }: NodeProps): React.ReactElement {
  return (
    <div className="flex min-w-20 items-center justify-center rounded border border-slate-500 bg-white px-3.5 py-2 shadow-sm">
      <Handle type="target" position={Position.Top} />
      <div className="max-w-[140px] break-words text-center text-xs font-normal text-slate-800">
        {data.label as string}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function DecisionNode({ data }: NodeProps): React.ReactElement {
  return (
    <div
      className="flex h-14 w-[88px] items-center justify-center border-[3px] border-violet-600 bg-violet-100 [-webkit-clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)] [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)] [box-shadow:0_2px_6px_rgb(109_40_217/0.25)]"
    >
      <Handle type="target" position={Position.Top} id="in" />
      <div className="max-w-[76px] break-words text-center text-[11px] font-semibold text-slate-800">
        {data.label as string}
      </div>
      <Handle type="source" position={Position.Right} id="then" />
      <Handle type="source" position={Position.Left} id="else" />
      <Handle type="source" position={Position.Bottom} id="out" />
    </div>
  )
}

function StartEndNode({ data }: NodeProps): React.ReactElement {
  const shape = data.shape as 'start' | 'end' | undefined
  const isStart = shape === 'start'
  const isEnd = shape === 'end'
  const wrapperClass = [
    'flex min-w-[72px] items-center justify-center rounded-full border-2 px-4 py-2 shadow-sm',
    isStart && 'border-green-600 bg-green-100 font-semibold',
    isEnd && 'border-blue-600 bg-blue-100 font-semibold',
    !isStart && !isEnd && 'border-slate-400 bg-white',
  ].filter(Boolean).join(' ')
  return (
    <div className={wrapperClass}>
      <Handle type="target" position={Position.Top} />
      <div className="text-center text-[13px] text-slate-800">
        {data.label as string}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const NODE_TYPES = {
  process: ProcessNode,
  decision: DecisionNode,
  startEnd: StartEndNode,
}

function graphToReactFlow(graph: FlowGraphInput): { nodes: Node[], edges: Edge[] } {
  const positions = layoutGraph(graph)
  const nodes: Node[] = graph.nodes.map((n, i) => ({
    id: n.id,
    type: nodeType(n.shape),
    position: positions.get(n.id) ?? { x: 0, y: i * 60 },
    data: {
      label: n.label ?? n.type ? `${n.id} (${n.type})` : n.id,
      ...(n.shape ? { shape: n.shape } : {}),
    },
  }))
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  const edges: Edge[] = graph.edges.map((e, i) => {
    const sourceNode = nodeById.get(e.source)
    const isFromDecision = sourceNode?.shape === 'decision'
    const sourceHandle = isFromDecision && e.kind === 'then' ? 'then' : isFromDecision && e.kind === 'else' ? 'else' : undefined
    return {
      id: `e-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      ...(sourceHandle ? { sourceHandle } : {}),
      type: e.kind === 'loopBack' ? 'smoothstep' : 'step',
      className: e.kind === 'loopBack' ? 'flow-edge-loop-back' : undefined,
      ...(e.kind && e.kind !== 'dependsOn' ? { label: EDGE_KIND_LABEL[e.kind] } : {}),
    }
  })
  return { nodes, edges }
}

export function FlowCanvas({ graph }: FlowCanvasProps): React.ReactElement {
  const { nodes: initialNodes, edges: initialEdges } = graphToReactFlow(graph)
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <ReactFlow
      nodeTypes={NODE_TYPES}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
