/**
 * Flow-viewer 型別：flow graph 從 @runflow/core re-export；
 * workspace API 回應型別與 vite-plugin-workspace-api 一致，前端與 plugin 共用。
 */
export type {
  FlowGraph,
  FlowGraphEdge,
  FlowGraphEdgeKind,
  FlowGraphNode,
  FlowGraphNodeShape,
} from '@runflow/core'

export interface WorkspaceStatus {
  workspaceRoot: string
  configPath: string | null
  configured: boolean
}

export interface TreeNode {
  id: string
  label: string
  type: 'folder' | 'file'
  flowId?: string
  name?: string
  children?: TreeNode[]
}

export interface TreeResponse {
  workspaceRoot: string
  configPath: string | null
  tree: TreeNode[]
}
