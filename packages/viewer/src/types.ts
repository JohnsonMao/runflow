/**
 * Flow-viewer 型別：flow graph 從 @runflow/workspace re-export；
 * workspace API 回應型別與 vite-plugin-workspace-api 一致，前端與 plugin 共用。
 */
import type {
  DiscoverEntry,
  FlowGraph,
  FlowGraphEdge,
  FlowGraphEdgeKind,
  FlowGraphNode,
  FlowGraphNodeShape,
  TreeNode,
} from '@runflow/workspace'

export type {
  DiscoverEntry,
  FlowGraph,
  FlowGraphEdge,
  FlowGraphEdgeKind,
  FlowGraphNode,
  FlowGraphNodeShape,
  TreeNode,
}

export interface WorkspaceStatus {
  workspaceRoot: string
  configPath: string | null
  configured: boolean
}

export interface TreeResponse {
  workspaceRoot: string
  configPath: string | null
  tree: TreeNode[]
  tagTree: TreeNode[]
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
  /** Handler key for OpenAPI handlers (e.g., 'scm', 'payments'). */
  handlerKey?: string
  /** Original relative file path (for folder expansion). */
  path?: string
}

/** Graph API response from GET /api/workspace/graph (extends FlowGraph with additional metadata). */
export interface FlowGraphResponse extends FlowGraph {
  flowId: string
  /** Flow name. */
  flowName?: string
  /** Flow description. */
  flowDescription?: string
  /** Original flowId before normalization (for OpenAPI handlers). */
  originalFlowId?: string
  /** Original relative file path (for folder expansion). */
  path?: string
  /** Absolute file path. */
  absPath?: string
  /** Handler key for OpenAPI handlers (e.g., 'scm', 'payments'). */
  handlerKey?: string
  /** Flow parameters. */
  params?: ParamDeclaration[]
  /** Step summaries. */
  steps?: DiscoverStepSummary[]
}

/**
 * WebSocket message payload types for each message type
 */
export interface WebSocketMessagePayloads {
  FLOW_RELOAD: FlowGraphResponse
  FLOW_START: { flowId: string }
  PARAMS_VALIDATION_ERROR: { error: string, fieldPaths: string[] }
  STEP_STATE_CHANGE: { stepId: string, status: string, outputs?: unknown, error?: string }
  ERROR: unknown
}

/**
 * Type-safe WebSocket message with discriminated union
 */
export type WebSocketMessage = {
  [K in keyof WebSocketMessagePayloads]: {
    type: K
    payload: WebSocketMessagePayloads[K]
  }
}[keyof WebSocketMessagePayloads]

/**
 * Type-safe broadcast function
 */
export type BroadcastFunction = <T extends keyof WebSocketMessagePayloads>(
  type: T,
  payload: WebSocketMessagePayloads[T],
) => void
