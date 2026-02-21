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

/** Nested param shape (no name; used in schema). */
export interface ParamSchemaProperty {
  type: string
  required?: boolean
  default?: unknown
  description?: string
  enum?: unknown[]
}

/** Param declaration for flow-review UI (name, type, required, default, description, nested schema). */
export interface ParamDeclaration {
  name: string
  type: string
  required?: boolean
  default?: unknown
  description?: string
  enum?: unknown[]
  /** For type object: nested properties (e.g. options.level, options.enabled). */
  schema?: Record<string, ParamSchemaProperty>
}

/** Step summary in flow detail. */
export interface DiscoverStepSummary {
  id: string
  type?: string
  name?: string
  description?: string
}

/** Flow detail from GET /api/workspace/detail (params + steps for flow-review UI). */
export interface FlowDetail {
  flowId: string
  name: string
  description?: string
  params?: ParamDeclaration[]
  steps?: DiscoverStepSummary[]
}
