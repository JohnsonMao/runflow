import type { NodeProps, ReactFlowInstance } from 'reactflow'
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
  canvasRef?: React.MutableRefObject<{ fitView: () => void } | null>
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

function ProcessNode({ data }: NodeProps<FlowGraphNode & { status?: string, hasExecutionStarted?: boolean }>): React.ReactElement {
  const status = data.status
  const hasExecutionStarted = data.hasExecutionStarted ?? false
  const statusStyles: Record<string, string> = {
    running: 'border-blue-600 border-2 ring-4 ring-blue-300 bg-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse',
    success: 'border-green-600 border-2 bg-green-100 shadow-[0_0_15px_rgba(34,197,94,0.5)]',
    failure: 'border-red-600 border-2 bg-red-100 shadow-[0_0_15px_rgba(239,68,68,0.5)]',
  }

  return (
    <div
      className={cn(
        'flex min-w-20 items-center justify-center rounded border border-slate-500 bg-white px-3.5 py-2 shadow-sm transition-all duration-300',
        // Idle state (no status): 50% opacity only if execution has started
        !status && hasExecutionStarted && 'opacity-50',
        // Active states: use statusStyles
        status && statusStyles[status],
        // Fallback for unknown status
        status && !statusStyles[status] && 'border-slate-500 bg-white',
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

function DecisionNode({ data }: NodeProps<FlowGraphNode & { status?: string, hasExecutionStarted?: boolean }>): React.ReactElement {
  const status = data.status
  const hasExecutionStarted = data.hasExecutionStarted ?? false
  return (
    <div
      className={cn(
        'relative flex min-w-20 items-center justify-center rounded border-2 border-violet-600 bg-violet-100 px-3.5 py-2 transition-all duration-300',
        // Idle state: 50% opacity only if execution has started
        !status && hasExecutionStarted && 'opacity-50',
        status === 'running' && 'ring-4 ring-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse',
        status === 'success' && 'bg-green-100 border-green-600 shadow-[0_0_15px_rgba(34,197,94,0.5)]',
        status === 'failure' && 'bg-red-100 border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]',
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
function LoopNode({ data }: NodeProps<FlowGraphNode & { status?: string, hasExecutionStarted?: boolean }>): React.ReactElement {
  const status = data.status
  const hasExecutionStarted = data.hasExecutionStarted ?? false
  const statusStyles: Record<string, string> = {
    running: 'border-blue-600 border-2 ring-4 ring-blue-300 bg-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse',
    success: 'border-green-600 border-2 bg-green-100 shadow-[0_0_15px_rgba(34,197,94,0.5)]',
    failure: 'border-red-600 border-2 bg-red-100 shadow-[0_0_15px_rgba(239,68,68,0.5)]',
  }
  return (
    <div
      className={cn(
        'relative flex min-w-20 items-center justify-center rounded border-2 border-amber-600 bg-amber-50 px-3.5 py-2 shadow-sm transition-all duration-300',
        // Idle state: 50% opacity only if execution has started
        !status && hasExecutionStarted && 'opacity-50',
        // Active states: use statusStyles to override default amber colors
        status && statusStyles[status],
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

function StartEndNode({ data }: NodeProps<FlowGraphNode & { status?: string, hasExecutionStarted?: boolean }>): React.ReactElement {
  const { shape, description, label } = data
  const status = data.status
  const hasExecutionStarted = data.hasExecutionStarted ?? false
  const isStart = shape === 'start'
  const isEnd = shape === 'end'
  return (
    <div
      className={cn(
        'flex min-w-[72px] items-center justify-center rounded border-2 px-4 py-2 shadow-sm transition-all duration-300',
        isStart && 'border-green-600 bg-green-100 font-semibold',
        isEnd && 'border-blue-600 bg-blue-100 font-semibold',
        !isStart && !isEnd && 'border-slate-400 bg-white',
        // Idle state: 50% opacity only if execution has started (for all nodes including end, but not start)
        !status && !isStart && hasExecutionStarted && 'opacity-50',
        status === 'running' && 'ring-4 ring-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse',
        status === 'success' && 'bg-green-100 border-green-600 shadow-[0_0_15px_rgba(34,197,94,0.5)]',
        status === 'failure' && 'bg-red-100 border-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]',
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

export function FlowCanvas({ graph, stepStatuses, canvasRef }: FlowCanvasProps): React.ReactElement {
  const { nodes: initialNodes, edges: initialEdges } = graphToReactFlow(graph)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync graph changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = graphToReactFlow(graph)
    setNodes(newNodes)
    setEdges(newEdges)
  }, [graph, setNodes, setEdges])

  // Sync stepStatuses into node data and update edges dynamically
  useEffect(() => {
    // Check if execution has started (any step has a status)
    const hasExecutionStarted = stepStatuses && Object.keys(stepStatuses).length > 0
    // Check if execution is currently running (any step is in 'running' state)
    const isExecutionRunning = stepStatuses && Object.values(stepStatuses).includes('running')

    // Update nodes with status and hasExecutionStarted flag
    setNodes(nds =>
      nds.map((node) => {
        const status = stepStatuses?.[node.id]
        const currentHasExecutionStarted = node.data.hasExecutionStarted ?? false
        // Update if status changed or hasExecutionStarted changed
        if (node.data.status !== status || currentHasExecutionStarted !== hasExecutionStarted) {
          return {
            ...node,
            data: { ...node.data, status, hasExecutionStarted },
          }
        }
        return node
      }),
    )

    if (!stepStatuses) {
      // Reset edges to default when no statuses
      setEdges(prev => prev.map(edge => ({
        ...edge,
        style: undefined,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
      })))
      return
    }

    // Update edges based on execution path
    setEdges(prev => prev.map((edge) => {
      const sourceStatus = stepStatuses[edge.source]
      const targetStatus = stepStatuses[edge.target]
      const edgeKind = edge.data?.kind as string | undefined

      // For condition nodes (then/else edges), only show the edge if target has status
      // This ensures only the executed branch is highlighted
      if (edgeKind === 'then' || edgeKind === 'else') {
        // If source is success but target has no status, don't show this edge
        // (it means this branch was not taken)
        if (sourceStatus === 'success' && !targetStatus) {
          return {
            ...edge,
            style: undefined,
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed },
          }
        }
        // If source is success and target has status, show the edge as green
        // (this branch was taken, edge itself is fine regardless of target result)
        if (sourceStatus === 'success' && targetStatus) {
          return {
            ...edge,
            style: {
              stroke: '#22c55e', // green-500 (edge is fine, error is in the step itself)
              strokeWidth: 3,
            },
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed },
          }
        }
      }

      // Case 1: Target is running - show blue dashed line with animation
      // This handles: source success/running/idle -> target running
      if (targetStatus === 'running') {
        return {
          ...edge,
          style: {
            stroke: '#3b82f6', // blue-500
            strokeWidth: 3,
            strokeDasharray: '10,5', // Dashed line
          },
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
        }
      }

      // Case 2: Completed path (source success -> target success or failure)
      // Edge is green because the source step executed successfully
      // Error is in the step itself, not the edge
      if (sourceStatus === 'success' && (targetStatus === 'success' || targetStatus === 'failure')) {
        return {
          ...edge,
          style: {
            stroke: '#22c55e', // green-500
            strokeWidth: 3,
            // No strokeDasharray = solid line
          },
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
        }
      }

      // Case 3: Source failed - edge should be gray (error prevents continuation)
      // Don't highlight edges from failed steps
      if (sourceStatus === 'failure') {
        return {
          ...edge,
          style: undefined,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
        }
      }

      // Case 4: Source completed but target not yet started (transition state)
      // Only show this during execution (when there's a running step)
      // This prevents showing edges after execution completes
      if (sourceStatus === 'success' && !targetStatus && isExecutionRunning) {
        return {
          ...edge,
          style: {
            stroke: '#22c55e', // green-500
            strokeWidth: 3,
            // No strokeDasharray = solid line (source is done, path is ready)
          },
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
        }
      }

      // Case 5: Source failed but target not yet started
      // Edge should be gray (error prevents continuation, edge itself is fine)
      // This case is already handled by Case 3, but keeping for clarity
      if (sourceStatus === 'failure' && !targetStatus) {
        return {
          ...edge,
          style: undefined,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed },
        }
      }

      // Reset to default for edges not in execution path
      return {
        ...edge,
        style: undefined,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
      }
    }))
  }, [stepStatuses, setNodes, setEdges, graph])

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
      onInit={(reactFlowInstance: ReactFlowInstance) => {
        if (canvasRef) {
          canvasRef.current = {
            fitView: () => {
              reactFlowInstance.fitView({ padding: 0.15, maxZoom: 1 })
            },
          }
        }
      }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  )
}
