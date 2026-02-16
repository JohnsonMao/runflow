import type { FlowGraphInput } from './types'
import { ChevronRight, FileCode2, Folder, FolderOpen, Moon, Sun } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FlowCanvas } from './FlowCanvas'

interface WorkspaceStatus {
  workspaceRoot: string
  configPath: string | null
  configured: boolean
}

interface TreeNode {
  id: string
  label: string
  type: 'folder' | 'file'
  flowId?: string
  name?: string
  children?: TreeNode[]
}

interface TreeResponse {
  workspaceRoot: string
  configPath: string | null
  tree: TreeNode[]
}

export function App(): React.ReactElement {
  const [graph, setGraph] = useState<FlowGraphInput | null>(null)
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus | null>(null)
  const [treeResponse, setTreeResponse] = useState<TreeResponse | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set())
  const [dark, setDark] = useState(false)
  const fetchingFlowIdRef = useRef<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('flow-viewer-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(stored === 'dark' || (stored !== 'light' && prefersDark))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem('flow-viewer-theme', 'dark')
    }
    else {
      root.classList.remove('dark')
      localStorage.setItem('flow-viewer-theme', 'light')
    }
  }, [dark])

  useEffect(() => {
    fetch('/api/workspace/status')
      .then(res => res.json())
      .then((data: WorkspaceStatus) => setWorkspaceStatus(data))
      .catch(() => setWorkspaceStatus(null))
  }, [])

  useEffect(() => {
    if (!workspaceStatus?.configured) {
      setTreeResponse(null)
      setTreeError(null)
      return
    }
    setTreeError(null)
    fetch('/api/workspace/tree')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? `Tree failed: ${res.status}`)
        }
        return res.json() as Promise<TreeResponse>
      })
      .then(setTreeResponse)
      .catch((err: unknown) => setTreeError(err instanceof Error ? err.message : 'Failed to load tree'))
  }, [workspaceStatus?.configured])

  useEffect(() => {
    if (!selectedFlowId) {
      setGraphError(null)
      fetchingFlowIdRef.current = null
      return
    }
    const flowIdForThisFetch = selectedFlowId
    fetchingFlowIdRef.current = flowIdForThisFetch
    setGraphError(null)
    setGraph(null)
    setGraphLoading(true)
    fetch(`/api/workspace/graph?flowId=${encodeURIComponent(selectedFlowId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok)
          throw new Error(data?.error ?? `Graph failed: ${res.status}`)
        return data as FlowGraphInput & { flowName?: string, flowDescription?: string }
      })
      .then((raw) => {
        if (fetchingFlowIdRef.current !== flowIdForThisFetch)
          return
        const graphInput: FlowGraphInput = {
          nodes: raw.nodes ?? [],
          edges: raw.edges ?? [],
          flowName: raw.flowName,
          flowDescription: raw.flowDescription,
        }
        if (graphInput.nodes.length > 0)
          setGraph(graphInput)
        else
          setGraph(null)
      })
      .catch((err: unknown) => {
        if (fetchingFlowIdRef.current !== flowIdForThisFetch)
          return
        setGraphError(err instanceof Error ? err.message : 'Failed to load graph')
        setGraph(null)
      })
      .finally(() => {
        if (fetchingFlowIdRef.current === flowIdForThisFetch)
          setGraphLoading(false)
      })
  }, [selectedFlowId])

  const displayError = treeError ?? graphError

  const { state: sidebarState } = useSidebar()
  const isSidebarCollapsed = sidebarState === 'collapsed'

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

  const indentPx = (d: number): number => 8 + d * 14

  function renderTreeNode(node: TreeNode, depth: number): React.ReactNode {
    if (node.type === 'file' && node.flowId) {
      return (
        <SidebarMenuItem key={node.id}>
          <SidebarMenuButton
            isActive={selectedFlowId === node.flowId}
            onClick={() => setSelectedFlowId(node.flowId!)}
            tooltip={node.name || node.label}
            className="min-h-8 gap-2 group-data-[collapsible=icon]:pl-2"
            style={isSidebarCollapsed ? undefined : { paddingLeft: `${indentPx(depth)}px` }}
          >
            <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-xs group-data-[collapsible=icon]:hidden" title={node.flowId}>
              {node.name || node.label}
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }
    if (node.type === 'folder' && node.children && node.children.length > 0) {
      const isOpen = openFolderIds.has(node.id)
      return (
        <Collapsible
          key={node.id}
          open={isOpen}
          onOpenChange={() => toggleFolder(node.id)}
        >
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex min-w-0 flex-1">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-sidebar-accent group-data-[collapsible=icon]:w-[30px] group-data-[collapsible=icon]:min-w-[30px] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
                      style={isSidebarCollapsed ? undefined : { paddingLeft: `${indentPx(depth)}px` }}
                    >
                      <ChevronRight
                        className={`size-3.5 shrink-0 transition-transform group-data-[collapsible=icon]:hidden ${isOpen ? 'rotate-90' : ''}`}
                        aria-hidden
                      />
                      {isOpen
                        ? <FolderOpen className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:block" aria-hidden />
                        : <Folder className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:block" aria-hidden />}
                      <span className="truncate font-medium group-data-[collapsible=icon]:hidden">{node.label}</span>
                    </button>
                  </CollapsibleTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" hidden={!isSidebarCollapsed}>
                {node.label}
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
          <CollapsibleContent>
            <div className="border-l border-sidebar-border pl-0 group-data-[collapsible=icon]:border-l-0 group-data-[collapsible=icon]:pl-0">
              {node.children.map(child => (
                <React.Fragment key={child.id}>
                  {renderTreeNode(child, depth + 1)}
                </React.Fragment>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )
    }
    return null
  }

  function renderSidebarTree(): React.ReactNode {
    if (!workspaceStatus?.configured) {
      return (
        <p className="px-2 py-4 text-xs text-muted-foreground">
          請設定工作區（見上方），並在該目錄放置 runflow.config 與 flows 目錄或 openapi 設定，左側即會出現資料夾樹。
        </p>
      )
    }
    if (!treeResponse) {
      return <p className="px-2 py-4 text-xs text-muted-foreground">載入中…</p>
    }
    if (treeResponse.tree.length === 0) {
      return (
        <p className="px-2 py-4 text-xs text-muted-foreground">
          未發現 flow（flowsDir 或 openapi 設定為空）。
        </p>
      )
    }
    return (
      <SidebarMenu className="gap-0">
        {treeResponse.tree.map(node => renderTreeNode(node, 0))}
      </SidebarMenu>
    )
  }

  function renderMainContent(): React.ReactNode {
    if (graphLoading) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          載入流程圖…
        </div>
      )
    }
    if (graph) {
      return (
        <ReactFlowProvider>
          <div className="h-full w-full">
            <FlowCanvas graph={graph} />
          </div>
        </ReactFlowProvider>
      )
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-muted-foreground">
        <p className="text-sm font-medium">點選左側資料夾樹中的 flow 檔案（.yaml）或 OpenAPI 操作</p>
        <p className="text-xs">
          工作區由 runflow.config 的 flowsDir 與 openapi 決定，與 CLI / MCP 設定一致。
        </p>
      </div>
    )
  }

  const workspacePath = workspaceStatus?.configured
    ? (workspaceStatus.configPath ?? workspaceStatus.workspaceRoot)
    : null
  const workspaceHint = workspacePath ?? 'Not set. Set FLOW_VIEWER_WORKSPACE_ROOT to a dir or config path.'

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Flows</SidebarGroupLabel>
              <SidebarGroupContent className="overflow-auto">
                {renderSidebarTree()}
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 py-2">
            <div className="flex min-w-0 shrink items-center gap-2">
              <SidebarTrigger aria-label="Toggle sidebar" />
              <h1 className="m-0 shrink-0 text-base font-semibold tracking-tight">Flow Viewer</h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help truncate text-xs text-muted-foreground underline decoration-dotted underline-offset-2">
                    Workspace
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[90vw] break-all font-mono text-[11px]">
                  {workspaceHint}
                </TooltipContent>
              </Tooltip>
              {graph?.flowName && (
                <span className="truncate text-sm text-muted-foreground" title={graph.flowName}>
                  {graph.flowName}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDark(d => !d)}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              <span className="sr-only">{dark ? 'Switch to light mode' : 'Switch to dark mode'}</span>
            </Button>
          </header>

          {displayError && (
            <Card className="mx-3 mt-2 shrink-0 border-destructive/50 bg-destructive/10">
              <CardContent className="p-3 text-sm text-destructive">
                {displayError}
              </CardContent>
            </Card>
          )}

          <SidebarInset className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <main className="h-full w-full overflow-auto">
              {renderMainContent()}
            </main>
          </SidebarInset>
        </div>
      </div>
    </div>
  )
}
