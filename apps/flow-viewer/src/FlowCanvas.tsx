import type { Edge, Node, NodeProps } from 'reactflow'
import type { FlowGraphInput, FlowGraphInputNode } from './types'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from 'reactflow'
import { getNodeShape } from './flowDefinitionToGraph'
import { layoutGraph } from './layout'
import { cn } from './lib/utils'

interface FlowCanvasProps {
  graph: FlowGraphInput
}

function nodeType(shape?: FlowGraphInputNode['shape']): string {
  if (shape === 'decision')
    return 'decision'
  if (shape === 'loop')
    return 'loop'
  if (shape === 'start' || shape === 'end')
    return 'startEnd'
  return 'process'
}

function ProcessNode({ data }: NodeProps<FlowGraphInputNode>): React.ReactElement {
  return (
    <div
      className="flex min-w-20 items-center justify-center rounded border border-slate-500 bg-white px-3.5 py-2 shadow-sm"
      title={data.description}
    >
      <Handle type="target" position={Position.Top} />
      <div className="max-w-[140px] wrap-break-words text-center text-xs font-normal text-slate-800">
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function DecisionNode({ data }: NodeProps<FlowGraphInputNode>): React.ReactElement {
  return (
    <div
      className="relative flex min-w-20 items-center justify-center rounded border-2 border-violet-600 bg-violet-100 px-3.5 py-2"
      title={data.description}
    >
      <div className="max-w-[200px] wrap-break-words text-center text-xs font-semibold text-slate-800">
        {data.label}
      </div>
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Right} id="then" />
      <Handle type="source" position={Position.Left} id="else" />
      <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-1 text-[10px] font-semibold text-violet-600 whitespace-nowrap" aria-hidden>then</span>
      <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-1 text-right text-[10px] font-semibold text-violet-600 whitespace-nowrap" aria-hidden>else</span>
    </div>
  )
}

/** Loop：上進入（含 loopBack）、下 loop 出去、右 done；版型與 process 一致 */
function LoopNode({ data }: NodeProps<FlowGraphInputNode>): React.ReactElement {
  return (
    <div
      className="relative flex min-w-20 items-center justify-center rounded border-2 border-amber-600 bg-amber-50 px-3.5 py-2 shadow-sm"
      title={data.description}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <div className="max-w-[140px] wrap-break-words text-center text-xs font-semibold text-amber-900">
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} id="out" />
      <Handle type="source" position={Position.Right} id="done" />
      <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full pt-0.5 text-[10px] font-semibold text-amber-700 whitespace-nowrap" aria-hidden>loop</span>
      <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-1 text-[10px] font-semibold text-amber-700 whitespace-nowrap" aria-hidden>done</span>
    </div>
  )
}

function StartEndNode({ data }: NodeProps<FlowGraphInputNode>): React.ReactElement {
  const { shape, description, label } = data
  const isStart = shape === 'start'
  const isEnd = shape === 'end'
  return (
    <div
      className={cn(
        'flex min-w-[72px] items-center justify-center rounded border-2 px-4 py-2 shadow-sm',
        isStart && 'border-green-600 bg-green-100 font-semibold',
        isEnd && 'border-blue-600 bg-blue-100 font-semibold',
        !isStart && !isEnd && 'border-slate-400 bg-white',
      )}
      title={description}
    >
      <Handle type="target" position={Position.Top} />
      <div className="text-center text-[13px] text-slate-800">
        {label}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

const NODE_TYPES = {
  process: ProcessNode,
  decision: DecisionNode,
  loop: LoopNode,
  startEnd: StartEndNode,
}

function graphToReactFlow(graph: FlowGraphInput): { nodes: Node[], edges: Edge[] } {
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
      defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
      className="react-flow-theme"
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
