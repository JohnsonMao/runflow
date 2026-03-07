import type { TreeNode, WorkspaceStatus } from './types'
import React, { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
} from '@/components/ui/sidebar'
import { FlowHeader } from './components/FlowHeader'
import { FlowMainContent } from './components/FlowMainContent'
import { FlowSidebar } from './components/FlowSidebar'
import { ResultDialog } from './components/ResultDialog'
import { useFlowGraph } from './hooks/use-flow-graph'
import { useTheme } from './hooks/use-theme'
import { useWorkspace } from './hooks/use-workspace'
import { setNested } from './lib/nested'

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

  // Initialize openFolderIds from URL (auto-expand to show selected flow)
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(() => {
    const params = new URLSearchParams(window.location.search)
    const flowId = params.get('flowId')
    const folders = new Set<string>()
    if (flowId) {
      if (flowId.includes(':')) {
        const prefix = flowId.split(':')[0]
        folders.add(`openapi:${prefix}`)
      }
      else {
        const parts = flowId.split('/')
        if (parts.length > 1) {
          for (let i = 1; i < parts.length; i++)
            folders.add(`folder:${parts.slice(0, i).join('/')}`)
        }
      }
    }
    return folders
  })

  // Sync selectedFlowId -> openFolderIds (auto-expand)
  useEffect(() => {
    if (selectedFlowId) {
      setOpenFolderIds((prev) => {
        const next = new Set(prev)
        if (selectedFlowId.includes(':')) {
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

  const [runResult, setRunResult] = useState<string | null>(null)
  const [runLoading, setRunLoading] = useState(false)
  const [paramsSheetOpen, setParamsSheetOpen] = useState(false)
  const [resultDialogOpen, setResultDialogOpen] = useState(false)

  const {
    graph,
    graphLoading,
    graphError,
    flowDetail,
    paramValues,
    setParamValues,
    isInitialized,
  } = useFlowGraph(selectedFlowId)

  // Clear run result when flow changes
  useEffect(() => {
    if (!selectedFlowId)
      setRunResult(null)
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

  const handleParamChange = (path: string, value: unknown): void => {
    setParamValues(prev => setNested(prev, path, value))
  }

  const handleRun = (): void => {
    if (!selectedFlowId || runLoading)
      return
    setRunLoading(true)
    setRunResult(null)
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
      .then(({ text }) => {
        setRunResult(text ?? null)
        setResultDialogOpen(true)
      })
      .catch((err: unknown) => {
        setRunResult(err instanceof Error ? err.message : 'Run failed')
        setResultDialogOpen(true)
      })
      .finally(() => setRunLoading(false))
  }

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
            flowDetail={flowDetail}
            paramValues={paramValues}
            onParamChange={handleParamChange}
            paramsSheetOpen={paramsSheetOpen}
            setParamsSheetOpen={setParamsSheetOpen}
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

          <SidebarInset className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <main className="h-full w-full overflow-auto">
              <FlowMainContent graphLoading={graphLoading} graph={graph} />
            </main>
          </SidebarInset>
        </div>
      </div>
      <ResultDialog
        open={resultDialogOpen}
        onOpenChange={setResultDialogOpen}
        result={runResult}
      />
    </div>
  )
}
