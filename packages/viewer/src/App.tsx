import type { LogEntry } from './components/ExecutionPanel'
import type { WebSocketMessage } from './hooks/use-websocket'
import type { TreeNode, WorkspaceStatus } from './types'
import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
} from '@/components/ui/sidebar'
import { ExecutionPanel } from './components/ExecutionPanel'
import { FlowHeader } from './components/FlowHeader'
import { FlowMainContent } from './components/FlowMainContent'
import { FlowSidebar } from './components/FlowSidebar'
import { useFlowGraph } from './hooks/use-flow-graph'
import { useTheme } from './hooks/use-theme'
import { useWebSocket } from './hooks/use-websocket'
import { useWorkspace } from './hooks/use-workspace'
import { setNested } from './lib/nested'
import { initialParamValuesFromDetail } from './lib/params'

function workspaceHint(workspaceStatus: WorkspaceStatus | null): string {
  if (!workspaceStatus?.configured)
    return 'Not set. Set RUNFLOW_CONFIG_PATH to a config path.'
  return workspaceStatus.configPath ?? workspaceStatus.workspaceRoot
}

export function App(): React.ReactElement {
  const [dark, setDark] = useTheme()
  const { workspaceStatus, treeResponse, treeError } = useWorkspace()

  // Initialize selectedFlowId from URL
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('flowId')
  })

  const [stepStatuses, setStepStatuses] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [executionPanelOpen, setExecutionPanelOpen] = useState(false)
  const [executionPanelTab, setExecutionPanelTab] = useState<'params' | 'logs'>('params')
  const [paramErrors, setParamErrors] = useState<Record<string, string>>({})
  const flowCanvasRef = useRef<{ fitView: () => void } | null>(null)
  const prevFlowIdRef = useRef<string | null>(selectedFlowId)

  // Initialize openFolderIds from URL (auto-expand to show selected flow)
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(() => {
    const folders = new Set<string>()
    const params = new URLSearchParams(window.location.search)
    const flowId = params.get('flowId')
    if (flowId) {
      // For normalized OpenAPI flow IDs, try to extract handler key
      if (flowId.includes('_')) {
        // Normalized ID like 'payments_get-users', extract handler key
        const parts = flowId.split('_')
        if (parts.length > 1)
          folders.add(`openapi:${parts[0]}`)
      }
      else if (flowId.includes(':')) {
        // Original format like 'payments:get-users'
        const prefix = flowId.split(':')[0]
        folders.add(`openapi:${prefix}`)
      }
      else {
        // File path format
        const parts = flowId.split('/')
        if (parts.length > 1) {
          for (let i = 1; i < parts.length; i++)
            folders.add(`folder:${parts.slice(0, i).join('/')}`)
        }
      }
    }
    return folders
  })

  // Sync selectedFlowId -> openFolderIds (auto-expand to show selected flow)
  useEffect(() => {
    if (selectedFlowId) {
      setOpenFolderIds((prev) => {
        const next = new Set(prev)
        // For normalized OpenAPI flow IDs, try to extract handler key
        if (selectedFlowId.includes('_')) {
          const parts = selectedFlowId.split('_')
          if (parts.length > 1)
            next.add(`openapi:${parts[0]}`)
        }
        else if (selectedFlowId.includes(':')) {
          const prefix = selectedFlowId.split(':')[0]
          next.add(`openapi:${prefix}`)
        }
        else {
          const parts = selectedFlowId.split('/')
          if (parts.length > 1) {
            for (let i = 1; i < parts.length; i++)
              next.add(`folder:${parts.slice(0, i).join('/')}`)
          }
        }
        return next
      })
    }
  }, [selectedFlowId])

  const [runLoading, setRunLoading] = useState(false)

  const {
    graph,
    graphLoading,
    graphError,
    flowDetail,
    paramValues,
    setParamValues,
    isInitialized,
    setGraph,
    setFlowDetail,
  } = useFlowGraph(selectedFlowId)

  // Update openFolderIds when flowDetail includes handlerKey or path (from Graph API)
  useEffect(() => {
    if (!flowDetail)
      return

    setOpenFolderIds((prev) => {
      const next = new Set(prev)

      // For OpenAPI handlers, expand the handler folder
      if (flowDetail.handlerKey) {
        next.add(`openapi:${flowDetail.handlerKey}`)
      }

      // For file flows, expand folders based on path
      if (flowDetail.path) {
        const parts = flowDetail.path.split('/')
        if (parts.length > 1) {
          // Expand all parent folders
          for (let i = 1; i < parts.length; i++) {
            next.add(`folder:${parts.slice(0, i).join('/')}`)
          }
        }
      }

      return next
    })
  }, [flowDetail])

  // Handle WebSocket messages
  const handleWebSocketMessage = React.useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'FLOW_RELOAD': {
        const payload = message.payload
        setGraph(payload)
        // Also update flow detail for params
        setFlowDetail({
          flowId: payload.flowId || selectedFlowId || '',
          name: payload.flowName || selectedFlowId || '',
          description: payload.flowDescription,
          params: payload.params || [],
        })
        setStepStatuses({}) // Clear statuses on reload
        setLogs([]) // Clear logs on reload
        break
      }
      case 'FLOW_START': {
        setStepStatuses({})
        setLogs([])
        setParamErrors({}) // Clear param errors on flow start
        // Auto-open sidebar and switch to Logs tab on execution start
        setExecutionPanelOpen(true)
        setExecutionPanelTab('logs')
        break
      }
      case 'PARAMS_VALIDATION_ERROR': {
        const { error, fieldPaths } = message.payload
        // Switch to Params tab and show errors
        setExecutionPanelOpen(true)
        setExecutionPanelTab('params')
        setRunLoading(false)

        // Build error map from field paths
        const errors: Record<string, string> = {}
        // Parse error message to map paths to messages
        // Format: "path1 (required): message1; path2: message2"
        const errorParts = error.split(';')
        for (const part of errorParts) {
          // Find the colon that separates path from message
          const colonIndex = part.indexOf(':')
          if (colonIndex > 0) {
            const pathPart = part.slice(0, colonIndex).trim()
            const message = part.slice(colonIndex + 1).trim()
            // Remove "(required)" from path if present
            const path = pathPart.replace(/\s*\(required\)\s*$/, '').trim()
            if (path && message)
              errors[path] = message
          }
        }
        setParamErrors(errors)

        // Focus on first error field after a short delay
        if (fieldPaths.length > 0) {
          setTimeout(() => {
            const firstErrorPath = fieldPaths[0]!
            const fieldId = `param-${firstErrorPath.replace(/\./g, '-')}`
            const fieldElement = document.getElementById(fieldId)
            if (fieldElement) {
              fieldElement.focus()
              fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 100)
        }
        break
      }
      case 'STEP_STATE_CHANGE': {
        const { stepId, status, outputs, error } = message.payload
        // Extract base stepId from prefixed stepId (e.g., "loop.iteration_1.loopBody" -> "loopBody")
        // This handles subSteps that are flattened with prefixes
        setStepStatuses(prev => ({ ...prev, [stepId]: status }))

        // Update logs: replace existing log for this stepId, or add new entry
        // Priority: replace 'running' status first, then replace the last occurrence of this stepId
        setLogs((prev) => {
          const newLog: LogEntry = {
            stepId,
            status,
            outputs: error ? { error, ...(outputs || {}) } : outputs,
            timestamp: Date.now(),
          }

          // First, try to find and replace a 'running' status log for this stepId
          const runningIndex = prev.findIndex(log => log.stepId === stepId && log.status === 'running')
          if (runningIndex >= 0) {
            // Replace running status with final status
            const updated = [...prev]
            updated[runningIndex] = newLog
            return updated
          }

          // If no 'running' status found, find the last occurrence of this stepId (from end to start)
          // This handles cases where a step might be updated multiple times
          let lastIndex = -1
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i]!.stepId === stepId) {
              lastIndex = i
              break
            }
          }

          if (lastIndex >= 0) {
            // Replace the last occurrence of this stepId
            const updated = [...prev]
            updated[lastIndex] = newLog
            return updated
          }

          // No existing log found, add new entry
          return [...prev, newLog]
        })
        break
      }
      case 'ERROR': {
        console.error('[Dev Error]', message.payload)
        break
      }
    }
  }, [setGraph, selectedFlowId])

  const { isConnected } = useWebSocket(window.location.host, handleWebSocketMessage)

  // Clear logs when flow changes (including switching between flows)
  useEffect(() => {
    // Clear logs when flowId changes (not just when it becomes null)
    if (prevFlowIdRef.current !== selectedFlowId) {
      setLogs([])
      setStepStatuses({})
      setParamErrors({}) // Clear param errors when flow changes
      prevFlowIdRef.current = selectedFlowId
    }
  }, [selectedFlowId])

  // Sync state to URL
  useEffect(() => {
    if (!isInitialized)
      return
    const url = new URL(window.location.href)
    if (selectedFlowId) {
      url.searchParams.set('flowId', selectedFlowId)
      if (paramValues && Object.keys(paramValues).length > 0) {
        url.searchParams.set('params', JSON.stringify(paramValues))
      }
      else {
        url.searchParams.delete('params')
      }
    }
    else {
      url.searchParams.delete('flowId')
      url.searchParams.delete('params')
    }
    window.history.replaceState({}, '', url.toString())
  }, [selectedFlowId, paramValues])

  // Sync URL changes back to state (e.g. browser back button)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search)
      const flowId = params.get('flowId')
      if (flowId !== selectedFlowId) {
        setSelectedFlowId(flowId)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [selectedFlowId])

  // Initialize defaults when flowDetail is received via WebSocket
  useEffect(() => {
    if (isConnected && flowDetail && Object.keys(paramValues).length === 0) {
      const defaults = initialParamValuesFromDetail(flowDetail)
      setParamValues(defaults)
    }
  }, [flowDetail, isConnected, setParamValues])

  const handleParamChange = (path: string, value: unknown): void => {
    setParamValues(prev => setNested(prev, path, value))
  }

  const handleRun = (): void => {
    if (!selectedFlowId || runLoading)
      return

    // Clear previous errors
    setParamErrors({})

    // Auto-open sidebar and switch to Logs tab when run starts
    setExecutionPanelOpen(true)
    setExecutionPanelTab('logs')

    // Use HTTP API for execution - it works in both dev and standalone modes
    // The HTTP API will broadcast execution results via WebSocket if broadcast is available
    setRunLoading(true)
    fetch('/api/workspace/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowId: selectedFlowId, params: paramValues }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({})) as { success?: boolean, text?: string }
        if (!res.ok)
          return { success: false, text: data?.text ?? `Run failed: ${res.status}` }
        return { success: data.success ?? false, text: data.text ?? '' }
      })
      .catch((err: unknown) => {
        // Add error to logs
        setLogs(prev => [
          ...prev,
          {
            stepId: 'error',
            status: 'failure',
            outputs: { error: err instanceof Error ? err.message : 'Run failed' },
            timestamp: Date.now(),
          },
        ])
      })
      .finally(() => setRunLoading(false))
  }

  // Handle canvas resizing when sidebar opens/closes
  useEffect(() => {
    // Use a small delay to ensure DOM has updated
    const timer = setTimeout(() => {
      if (flowCanvasRef.current) {
        flowCanvasRef.current.fitView()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [executionPanelOpen])

  const toggleFolder = (id: string): void => {
    setOpenFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id))
        next.delete(id)
      else
        next.add(id)
      return next
    })
  }

  // Aggregate errors from tree entries (for global duplicate ID warning)
  const treeEntriesError = React.useMemo(() => {
    if (!treeResponse)
      return null
    const findErrors = (nodes: TreeNode[]): string[] => {
      let errors: string[] = []
      for (const node of nodes) {
        if (node.error)
          errors.push(node.error)
        if (node.children)
          errors = [...errors, ...findErrors(node.children)]
      }
      return errors
    }
    const allErrors = findErrors(treeResponse.tree)
    if (allErrors.length === 0)
      return null
    return `Workspace errors detected: ${allErrors.join('; ')}`
  }, [treeResponse])

  const displayError = treeError ?? treeEntriesError ?? graphError

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Flows</SidebarGroupLabel>
              <SidebarGroupContent className="overflow-auto">
                <FlowSidebar
                  workspaceStatus={workspaceStatus}
                  treeResponse={treeResponse}
                  selectedFlowId={selectedFlowId}
                  onSelectFlow={setSelectedFlowId}
                  openFolderIds={openFolderIds}
                  onToggleFolder={toggleFolder}
                />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <FlowHeader
            workspaceHint={workspaceHint(workspaceStatus)}
            flowName={graph?.flowName}
            selectedFlowId={selectedFlowId}
            executionPanelOpen={executionPanelOpen}
            setExecutionPanelOpen={setExecutionPanelOpen}
            runLoading={runLoading}
            onRun={handleRun}
            dark={dark}
            setDark={setDark}
          />

          {displayError && (
            <Card className="mx-3 mt-2 shrink-0 border-destructive/50 bg-destructive/10">
              <CardContent className="p-3 text-sm text-destructive">
                {displayError}
              </CardContent>
            </Card>
          )}

          <div className="flex min-h-0 min-w-0 flex-1">
            <SidebarInset className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <main className="h-full w-full overflow-auto">
                <FlowMainContent
                  graphLoading={graphLoading}
                  graph={graph}
                  stepStatuses={stepStatuses}
                  canvasRef={flowCanvasRef}
                />
              </main>
            </SidebarInset>
            {executionPanelOpen && (
              <div className="w-96 shrink-0">
                <ExecutionPanel
                  flowDetail={flowDetail}
                  paramValues={paramValues}
                  onParamChange={handleParamChange}
                  logs={logs}
                  activeTab={executionPanelTab}
                  onTabChange={setExecutionPanelTab}
                  paramErrors={paramErrors}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
