import type { FlowDefinition, FlowStep, ParamDeclaration } from '@runflow/core'

/** Operation key: always "METHOD path" (e.g. "GET /users") for unique, filename-consistent keys. */
export type OperationKey = string

/** Step definition for hook injection; id optional (adapter will auto-generate if missing). */
export type StepDef = Omit<FlowStep, 'id'> & { id?: string }

/** Per-operation hook config: steps to insert before and after the API step. */
export interface OperationHooks {
  before?: StepDef[]
  after?: StepDef[]
}

/** Filter to limit which operations are converted (e.g. single operation or by tag). */
export interface OperationFilter {
  /** Include only this method (e.g. 'GET'). */
  method?: string
  /** Include only this path (e.g. '/users'). */
  path?: string
  /** Include only operations with this operationId. */
  operationId?: string
  /** Include only operations with any of these tags. */
  tags?: string[]
}

/**
 * Hook entry for batch: pattern = exact operation key (string), regex source (string with ^ $ etc.), or RegExp.
 * When pattern is a string: if it contains regex metacharacters (^ $ [ ] ( ) * + ? . \ etc.), it is used as RegExp source; otherwise exact key match.
 * When using array form, all matching entries are merged (before/after concatenated in order).
 */
export interface HooksEntry {
  pattern: OperationKey | RegExp | string
  hooks: OperationHooks
}

/** Options for openApiToFlows. */
export interface OpenApiToFlowsOptions {
  /**
   * Output mode: 'memory' (default) returns flow(s) in memory only;
   * { outputDir: string } writes each flow to a file under that directory.
   */
  output?: 'memory' | { outputDir: string }
  /** Base URL for the API (e.g. https://api.example.com). Used to build full request URL. */
  baseUrl?: string
  /** Limit which operations to convert. When omitted, all operations are converted. */
  operationFilter?: OperationFilter
  /**
   * Hooks: Record<key, hooks> for exact key, or HooksEntry[] for batch (pattern = string or RegExp).
   * Array: all matching entries merged (before/after concatenated).
   */
  hooks?: Partial<Record<OperationKey, OperationHooks>> | HooksEntry[]
}

/** Result when output is 'memory': map of operation key to flow. */
export type OpenApiToFlowsResult = Map<OperationKey, FlowDefinition>

/** Parsed OpenAPI document (minimal shape we need for conversion). */
export interface OpenApiDocument {
  openapi?: string
  paths?: Record<string, PathItem>
  servers?: Array<{ url?: string }>
  components?: {
    schemas?: Record<string, OpenApiSchema>
  }
}

export interface PathItem {
  get?: OperationObject
  put?: OperationObject
  post?: OperationObject
  delete?: OperationObject
  patch?: OperationObject
  options?: OperationObject
  head?: OperationObject
  parameters?: ParameterObject[]
}

export interface OperationObject {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: ParameterObject[]
  requestBody?: RequestBodyObject
  responses?: Record<string, unknown>
}

export interface ParameterObject {
  name: string
  in: 'path' | 'query' | 'header'
  required?: boolean
  description?: string
  schema?: OpenApiSchema
}

export interface OpenApiSchema {
  type?: string
  enum?: unknown[]
  description?: string
  items?: OpenApiSchema
  properties?: Record<string, OpenApiSchema>
  required?: string[]
  $ref?: string
  allOf?: OpenApiSchema[]
}

export interface RequestBodyObject {
  description?: string
  content?: Record<string, { schema?: OpenApiSchema }>
}
