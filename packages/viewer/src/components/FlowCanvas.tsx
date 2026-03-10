import type { NodeProps } from 'reactflow'
import type { FlowGraph, FlowGraphNode } from '../types'
import { useEffect } from 'react'
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
import { graphToReactFlow } from '../flowGraphToReactFlow'
import { cn } from '../lib/utils'

interface FlowCanvasProps {
  graph: FlowGraph
  stepStatuses?: Record<string, string>
}

function StatusIndicator({ status }: { status?: string }) {
  if (!status)
    return null
  const colors: Record<string, string> = {
    running: 'bg-blue-500 animate-pulse',
    success: 'bg-green-500',
    failure: 'bg-red-500',
  }
  return (
    <div className={cn('absolute -top-1 -right-1 h-3 w-3 rounded-full border border-white shadow-sm z-10', colors[status] || 'bg-slate-300')} />
  )
}

function ProcessNode({ data }: NodeProps<FlowGraphNode & { status?: string }>): React.ReactElement {
  const status = data.status
  const statusStyles: Record<string, string> = {
    running: 'border-blue-500 ring-2 ring-blue-200 bg-blue-50',
    success: 'border-green-500 bg-green-50',
    failure: 'border-red-500 bg-red-50',
  }

  return (
    <div
      className={cn(
        'flex min-w-20 items-center justify-center rounded border border-slate-500 bg-white px-3.5 py-2 shadow-sm transition-colors',
        status && statusStyles[status],
      )}
      title={data.description}
    >
      <StatusIndicator status={status} />
      <Handle type="target" position={Position.Top} />
      <div className="max-w-[140px] wrap-break-words text-center text-xs font-normal text-slate-800">
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function DecisionNode({ data }: NodeProps<FlowGraphNode & { status?: string }>): React.ReactElement {
  const status = data.status
  return (
    <div
      className={cn(
        'relative flex min-w-20 items-center justify-center rounded border-2 border-violet-600 bg-violet-100 px-3.5 py-2 transition-colors',
        status === 'running' && 'ring-2 ring-blue-200',
        status === 'success' && 'bg-green-100 border-green-600',
        status === 'failure' && 'bg-red-100 border-red-600',
      )}
      title={data.description}
    >
      <StatusIndicator status={status} />
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
function LoopNode({ data }: NodeProps<FlowGraphNode & { status?: string }>): React.ReactElement {
  const status = data.status
  return (
    <div
      className={cn(
        'relative flex min-w-20 items-center justify-center rounded border-2 border-amber-600 bg-amber-50 px-3.5 py-2 shadow-sm transition-colors',
        status === 'running' && 'ring-2 ring-blue-200',
        status === 'success' && 'bg-green-100 border-green-600',
        status === 'failure' && 'bg-red-100 border-red-600',
      )}
      title={data.description}
    >
      <StatusIndicator status={status} />
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

function StartEndNode({ data }: NodeProps<FlowGraphNode & { status?: string }>): React.ReactElement {
  const { shape, description, label } = data
  const status = data.status
  const isStart = shape === 'start'
  const isEnd = shape === 'end'
  return (
    <div
      className={cn(
        'flex min-w-[72px] items-center justify-center rounded border-2 px-4 py-2 shadow-sm transition-colors',
        isStart && 'border-green-600 bg-green-100 font-semibold',
        isEnd && 'border-blue-600 bg-blue-100 font-semibold',
        !isStart && !isEnd && 'border-slate-400 bg-white',
        status === 'running' && 'ring-2 ring-blue-200',
        status === 'success' && 'bg-green-100 border-green-600',
        status === 'failure' && 'bg-red-100 border-red-600',
      )}
      title={description}
    >
      <StatusIndicator status={status} />
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

export function FlowCanvas({ graph, stepStatuses }: FlowCanvasProps): React.ReactElement {
  const { nodes: initialNodes, edges: initialEdges } = graphToReactFlow(graph)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync graph changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = graphToReactFlow(graph)
    setNodes(newNodes)
    setEdges(newEdges)
  }, [graph, setNodes, setEdges])

  // Sync stepStatuses into node data
  useEffect(() => {
    if (!stepStatuses)
      return
    setNodes(nds =>
      nds.map((node) => {
        const status = stepStatuses[node.id]
        if (status && node.data.status !== status) {
          return {
            ...node,
            data: { ...node.data, status },
          }
        }
        return node
      }),
    )
  }, [stepStatuses, setNodes])

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
