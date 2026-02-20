import type { FlowDefinition } from '@runflow/core'

/** Operation key: always "METHOD path" (e.g. "GET /users") for unique, filename-consistent keys. */
export type OperationKey = string

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

/** Which param kinds to expose in flow.params. Omitted or true = exposed; false = hidden. Default: path/query/body exposed, header/cookie hidden. */
export interface ParamExposeConfig {
  path?: boolean
  query?: boolean
  body?: boolean
  header?: boolean
  cookie?: boolean
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
  /** Which param kinds to include in flow.params. Default: path, query, body exposed; header, cookie hidden. */
  paramExpose?: ParamExposeConfig
  /** When set, the API step uses this handler (name or path) instead of type 'http'; step payload is url, method, headers, body. Step type = this string (handler name). When override is a module path, set overrideStepType so the step type is a name, not the path. */
  override?: string
  /** Only when override is a module path: use this as the generated step type. When override is a handler name, omit this (step type = override). */
  overrideStepType?: string
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
