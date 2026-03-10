import type { TreeNode, TreeResponse, WorkspaceStatus } from '../types'
import { AlertCircle, ChevronRight, FileCode2, Folder, FolderOpen, Tag } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const INDENT_PX_BASE = 8
const INDENT_PX_PER_LEVEL = 14

function indentPx(depth: number): number {
  return INDENT_PX_BASE + depth * INDENT_PX_PER_LEVEL
}

interface TreeNodeItemProps {
  node: TreeNode
  depth: number
  selectedFlowId: string | null
  onSelectFlow: (flowId: string) => void
  openFolderIds: Set<string>
  onToggleFolder: (id: string) => void
  isSidebarCollapsed: boolean
}

function TreeNodeItem({
  node,
  depth,
  selectedFlowId,
  onSelectFlow,
  openFolderIds,
  onToggleFolder,
  isSidebarCollapsed,
}: TreeNodeItemProps): React.ReactElement | null {
  if (node.type === 'file' && node.flowId) {
    return (
      <SidebarMenuItem key={node.id}>
        <SidebarMenuButton
          isActive={selectedFlowId === node.flowId}
          onClick={() => onSelectFlow(node.flowId!)}
          tooltip={node.name || node.label}
          className="min-h-8 gap-2 group-data-[collapsible=icon]:pl-2"
          style={isSidebarCollapsed ? undefined : { paddingLeft: `${indentPx(depth)}px` }}
        >
          <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="truncate text-xs" title={node.flowId}>
              {node.name || node.label}
            </span>
            {node.error && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle className="size-3 shrink-0 text-destructive" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px] border-destructive bg-destructive text-destructive-foreground">
                  {node.error}
                </TooltipContent>
              </Tooltip>
            )}
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
        onOpenChange={() => onToggleFolder(node.id)}
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
              <TreeNodeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedFlowId={selectedFlowId}
                onSelectFlow={onSelectFlow}
                openFolderIds={openFolderIds}
                onToggleFolder={onToggleFolder}
                isSidebarCollapsed={isSidebarCollapsed}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }
  return null
}

interface FlowSidebarProps {
  workspaceStatus: WorkspaceStatus | null
  treeResponse: TreeResponse | null
  selectedFlowId: string | null
  onSelectFlow: (flowId: string) => void
  openFolderIds: Set<string>
  onToggleFolder: (id: string) => void
}

export function FlowSidebar({
  workspaceStatus,
  treeResponse,
  selectedFlowId,
  onSelectFlow,
  openFolderIds,
  onToggleFolder,
}: FlowSidebarProps): React.ReactElement {
  const { state: sidebarState } = useSidebar()
  const isSidebarCollapsed = sidebarState === 'collapsed'

  const [viewMode, setViewMode] = useState<'folders' | 'tags'>(() => {
    const saved = localStorage.getItem('flow-viewer-sidebar-view')
    return (saved === 'tags' ? 'tags' : 'folders')
  })

  useEffect(() => {
    localStorage.setItem('flow-viewer-sidebar-view', viewMode)
  }, [viewMode])

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

  const hasFlows = treeResponse.tree.length > 0 || treeResponse.tagTree.length > 0

  if (!hasFlows) {
    return (
      <p className="px-2 py-4 text-xs text-muted-foreground">
        未發現 flow（flowsDir 或 openapi 設定為空）。
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <Tabs value={viewMode} onValueChange={v => setViewMode(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="folders" className="text-[10px] px-0">
            <Folder className="size-3 mr-1" />
            <span className="group-data-[collapsible=icon]:hidden">Folders</span>
          </TabsTrigger>
          <TabsTrigger value="tags" className="text-[10px] px-0">
            <Tag className="size-3 mr-1" />
            <span className="group-data-[collapsible=icon]:hidden">Tags</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="folders" className="mt-2 border-0 p-0 focus-visible:ring-0">
          <SidebarMenu className="gap-0">
            {treeResponse.tree.map((node: TreeNode) => (
              <TreeNodeItem
                key={node.id}
                node={node}
                depth={0}
                selectedFlowId={selectedFlowId}
                onSelectFlow={onSelectFlow}
                openFolderIds={openFolderIds}
                onToggleFolder={onToggleFolder}
                isSidebarCollapsed={isSidebarCollapsed}
              />
            ))}
          </SidebarMenu>
        </TabsContent>
        <TabsContent value="tags" className="mt-2 border-0 p-0 focus-visible:ring-0">
          <SidebarMenu className="gap-0">
            {treeResponse.tagTree.map((node: TreeNode) => (
              <TreeNodeItem
                key={node.id}
                node={node}
                depth={0}
                selectedFlowId={selectedFlowId}
                onSelectFlow={onSelectFlow}
                openFolderIds={openFolderIds}
                onToggleFolder={onToggleFolder}
                isSidebarCollapsed={isSidebarCollapsed}
              />
            ))}
          </SidebarMenu>
        </TabsContent>
      </Tabs>
    </div>
  )
}
