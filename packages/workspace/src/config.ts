import type { OpenApiDocument, OpenApiToFlowsOptions, ParamExposeConfig } from '@runflow/convention-openapi'
import type { FlowDefinition, IStepHandler, ParamDeclaration, ResolveFlowFn, StepRegistry } from '@runflow/core'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadOpenApiDocument, openApiToFlows } from '@runflow/convention-openapi'
import { loadFromFile } from '@runflow/core'
import { createBuiltinRegistry } from '@runflow/handlers'

export const CONFIG_NAMES = ['runflow.config.mjs', 'runflow.config.js', 'runflow.config.json'] as const

/** OpenAPI entry in handlers: specPaths required; paths resolved relative to config file directory. */
export interface OpenApiHandlerEntry {
  specPaths: string[]
  baseUrl?: string
  operationFilter?: OpenApiToFlowsOptions['operationFilter']
  paramExpose?: ParamExposeConfig
  /** Optional path to .mjs that runs the API step; when omitted, built-in http handler is used. */
  handler?: string
}

/** Handlers key = step type; value = module path (string) or OpenAPI entry (object with specPaths). */
export interface RunflowConfig {
  handlers?: Record<string, string | OpenApiHandlerEntry>
  /** Directory to resolve file flowIds (relative to config dir). When set, flowId is relative to this. */
  flowsDir?: string
  /**
   * Global param declarations (same shape as flow params). Defaults live in each item's default.
   * Runners merge with flow.params (flow overrides same name) for effective declaration.
   */
  params?: ParamDeclaration[]
}

export interface ResolvedFileFlow {
  type: 'file'
  path: string
}

export interface ResolvedOpenApiFlow {
  type: 'openapi'
  specPaths: string[]
  operation: string
  options: Partial<OpenApiToFlowsOptions>
}

export type ResolvedFlow = ResolvedFileFlow | ResolvedOpenApiFlow

/**
 * Load multiple OpenAPI spec files, merge into one document (paths and components: later overwrites).
 * Paths in specPaths are resolved relative to configDir when not absolute.
 */
export async function mergeOpenApiSpecs(specPaths: string[], configDir: string): Promise<OpenApiDocument> {
  if (specPaths.length === 0)
    return { openapi: '3.0.0', paths: {} }
  const docs = await Promise.all(specPaths.map((p) => {
    const abs = path.isAbsolute(p) ? p : path.resolve(configDir, p)
    return loadOpenApiDocument(abs)
  }))
  const merged: OpenApiDocument = { openapi: docs[0]?.openapi ?? '3.0.0', paths: {}, components: { schemas: {} } }
  for (const doc of docs) {
    if (doc.paths)
      Object.assign(merged.paths!, doc.paths)
    if (doc.components?.schemas)
      Object.assign(merged.components!.schemas!, doc.components.schemas)
    if (doc.servers?.length && !merged.servers?.length)
      merged.servers = doc.servers
  }
  return merged
}

/** True when value is an object with specPaths (array of strings) (OpenAPI handler entry). */
export function isOpenApiHandlerEntry(entry: unknown): entry is OpenApiHandlerEntry {
  return (
    typeof entry === 'object'
    && entry !== null
    && 'specPaths' in entry
    && Array.isArray((entry as OpenApiHandlerEntry).specPaths)
    && (entry as OpenApiHandlerEntry).specPaths.every((p): p is string => typeof p === 'string')
  )
}

/**
 * Normalize config params: if raw is a plain object (legacy), convert to ParamDeclaration[].
 * If already an array, return as-is. Otherwise return undefined.
 */
export function normalizeConfigParams(raw: unknown): ParamDeclaration[] | undefined {
  if (raw === undefined || raw === null)
    return undefined
  if (Array.isArray(raw))
    return raw as ParamDeclaration[]
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    return Object.keys(obj).map(name => ({
      name,
      type: 'string' as const,
      default: obj[name],
    }))
  }
  return undefined
}

/**
 * Merge config global params with flow params. Flow params override config for the same name; flow-only params are appended.
 */
export function mergeParamDeclarations(
  configParams: ParamDeclaration[] | undefined,
  flowParams: ParamDeclaration[] | undefined,
): ParamDeclaration[] {
  const config = configParams ?? []
  const flow = flowParams ?? []
  const byName = new Map<string, ParamDeclaration>()
  for (const p of config)
    byName.set(p.name, p)
  for (const p of flow)
    byName.set(p.name, p)
  return [...byName.values()]
}

export async function loadConfig(configPath: string): Promise<RunflowConfig | null> {
  if (!existsSync(configPath) || !statSync(configPath).isFile())
    return null
  let data: RunflowConfig | null = null
  if (configPath.endsWith('.json')) {
    try {
      const raw = readFileSync(configPath, 'utf-8')
      data = JSON.parse(raw) as RunflowConfig
      if (!data || typeof data !== 'object')
        return null
    }
    catch {
      return null
    }
  }
  else {
    try {
      const mod = await import(pathToFileURL(configPath).href) as { default?: RunflowConfig }
      data = mod.default ?? null
    }
    catch {
      return null
    }
  }
  if (data && 'params' in data && data.params !== undefined) {
    const normalized = normalizeConfigParams(data.params)
    if (normalized !== undefined)
      data = { ...data, params: normalized }
  }
  return data
}

export function findConfigFile(cwd: string): string | null {
  for (const name of CONFIG_NAMES) {
    const p = path.join(cwd, name)
    if (existsSync(p) && statSync(p).isFile())
      return p
  }
  return null
}

export function resolveFlowId(
  flowId: string,
  config: RunflowConfig | null,
  configDir: string,
  cwd: string,
): ResolvedFlow {
  const handlers = config?.handlers && typeof config.handlers === 'object' ? config.handlers : null
  if (handlers) {
    const colonIndex = flowId.indexOf(':')
    if (colonIndex > 0 && colonIndex < flowId.length - 1) {
      const key = flowId.slice(0, colonIndex)
      const operation = flowId.slice(colonIndex + 1)
      const entry = handlers[key]
      if (isOpenApiHandlerEntry(entry)) {
        const specPaths = entry.specPaths.map(p =>
          path.isAbsolute(p) ? p : path.resolve(configDir, p),
        )
        const options = {
          stepType: key,
          baseUrl: entry.baseUrl,
          operationFilter: entry.operationFilter,
          paramExpose: entry.paramExpose,
        }
        return {
          type: 'openapi',
          specPaths,
          operation,
          options,
        }
      }
    }
  }
  const baseDir = config?.flowsDir
    ? path.resolve(configDir, config.flowsDir)
    : cwd
  const filePath = path.isAbsolute(flowId) ? flowId : path.resolve(baseDir, flowId)
  return { type: 'file', path: filePath }
}

// --- Load flow (resolve + load) ---

export interface LoadedFlow {
  flow: FlowDefinition
}

async function loadFlowFromResolved(resolved: ResolvedFlow, configDir: string): Promise<LoadedFlow> {
  if (resolved.type === 'openapi') {
    const merged = await mergeOpenApiSpecs(resolved.specPaths, configDir)
    const flows = await openApiToFlows(merged, { ...resolved.options, output: 'memory', stepType: resolved.options.stepType ?? 'http' })
    const selected = flows.get(resolved.operation)
    if (!selected) {
      const keys = [...flows.keys()].slice(0, 10).join(', ')
      throw new Error(`Operation "${resolved.operation}" not found. Available (sample): ${keys}${flows.size > 10 ? '...' : ''}`)
    }
    return { flow: selected }
  }
  if (!existsSync(resolved.path) || !statSync(resolved.path).isFile())
    throw new Error(`File not found or not a regular file: ${resolved.path}`)
  const flow = loadFromFile(resolved.path)
  if (!flow)
    throw new Error('Invalid or unreadable flow file.')
  return { flow }
}

/**
 * Resolve flowId and load the flow. Convenience for callers that have config/configDir/cwd.
 * @throws Error with user-facing message when file/spec not found, operation not found, or flow invalid.
 */
export async function resolveAndLoadFlow(
  flowId: string,
  config: RunflowConfig | null,
  configDir: string,
  cwd: string,
): Promise<LoadedFlow> {
  const resolved = resolveFlowId(flowId, config, configDir, cwd)
  return loadFlowFromResolved(resolved, configDir)
}

export function createResolveFlow(
  config: RunflowConfig | null,
  configDir: string,
  cwd: string,
): ResolveFlowFn {
  return async (flowId: string) => {
    const resolved = resolveFlowId(flowId, config, configDir, cwd)
    if (resolved.type === 'openapi') {
      try {
        const merged = await mergeOpenApiSpecs(resolved.specPaths, configDir)
        const flows = await openApiToFlows(merged, { ...resolved.options, output: 'memory', stepType: resolved.options.stepType ?? 'http' })
        const selected = flows.get(resolved.operation)
        if (!selected)
          return null
        return { flow: selected }
      }
      catch {
        return null
      }
    }
    if (!existsSync(resolved.path) || !statSync(resolved.path).isFile())
      return null
    const loaded = loadFromFile(resolved.path)
    if (!loaded)
      return null
    return { flow: loaded }
  }
}

/**
 * Build a StepRegistry by merging built-in handlers with custom handlers from config.
 * Handles both module-based handlers and OpenAPI-based (default http) handlers.
 */
export async function buildRegistryFromConfig(config: RunflowConfig | null, configDir: string): Promise<StepRegistry> {
  const registry = createBuiltinRegistry()
  if (!config?.handlers || typeof config.handlers !== 'object')
    return registry

  const httpHandler = registry.http
  for (const [type, value] of Object.entries(config.handlers)) {
    if (typeof value === 'string') {
      const resolved = path.resolve(configDir, value)
      if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        throw new Error(`Handler module not found for type "${type}": ${resolved}`)
      }
      try {
        const mod = await import(pathToFileURL(resolved).href) as { default?: IStepHandler }
        const handler = mod.default
        if (!handler || typeof handler.run !== 'function') {
          throw new Error(`Handler module for "${type}" must export default (IStepHandler).`)
        }
        registry[type] = handler
      }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(`Failed to load handler "${type}": ${msg}`)
      }
      continue
    }

    if (!isOpenApiHandlerEntry(value))
      continue

    if (value.handler) {
      const resolved = path.resolve(configDir, value.handler)
      if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        throw new Error(`OpenAPI handler module not found for type "${type}": ${resolved}`)
      }
      try {
        const mod = await import(pathToFileURL(resolved).href) as { default?: IStepHandler }
        const handler = mod.default
        if (!handler || typeof handler.run !== 'function') {
          throw new Error(`Handler module for "${type}" must export default (IStepHandler).`)
        }
        registry[type] = handler
      }
      catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(`Failed to load handler "${type}": ${msg}`)
      }
    }
    else {
      registry[type] = httpHandler
    }
  }
  return registry
}
