import type { NodeProps } from 'reactflow'
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
import { graphToReactFlow } from './flowGraphToReactFlow'
import { cn } from './lib/utils'

interface FlowCanvasProps {
  graph: FlowGraphInput
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
