import type { OpenApiDocument, OpenApiToFlowsOptions, ParamExposeConfig } from '@runflow/convention-openapi'
import type { FlowDefinition, HandlerConfig, HandlerFactory, ParamDeclaration, StepRegistry } from '@runflow/core'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadOpenApiDocument, openApiToFlows } from '@runflow/convention-openapi'
import { buildRegistry, createFactoryContext } from '@runflow/core'
import { builtinHandlers } from '@runflow/handlers'
import { loadFromFile } from './loadFlow'

/** OpenAPI entry in handlers: specPaths required; paths resolved relative to config file directory. */
export interface OpenApiHandlerEntry {
  specPaths: string[]
  baseUrl?: string
  operationFilter?: OpenApiToFlowsOptions['operationFilter']
  paramExpose?: ParamExposeConfig
  /** Optional path to .mjs that runs the API step; when omitted, built-in http handler is used. */
  handler?: string
  /** Internal type identifier for the API step. Required when using array-based handlers. */
  type?: string
}

/** Handlers can be an array of module paths/entries or a mapping of type -> module path/entry. */
export interface RunflowConfig {
  handlers?: (string | OpenApiHandlerEntry)[] | Record<string, string | OpenApiHandlerEntry>
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

/** (flowId: string) => Promise<{ flow: FlowDefinition } | null>. Used when building flowMap or resolving flows for run. */
export type ResolveFlowFn = (flowId: string) => Promise<{ flow: FlowDefinition } | null>

/**
 * Build a flowMap for run(): collect all step.flow ids from mainFlow (and nested flows), resolve and load each, return map.
 * Used by CLI/apps so core run() receives flowMap instead of resolveFlow.
 */
export async function buildFlowMapForRun(
  mainFlow: FlowDefinition,
  resolveFlow: ResolveFlowFn,
): Promise<Record<string, FlowDefinition>> {
  const flowMap: Record<string, FlowDefinition> = {}
  const toLoad = new Set<string>()
  function collect(flow: FlowDefinition): void {
    for (const step of flow.steps) {
      const id = (step as { flow?: string }).flow
      if (typeof id === 'string' && id.trim() && !flowMap[id])
        toLoad.add(id)
    }
  }
  collect(mainFlow)
  while (toLoad.size > 0) {
    const id = toLoad.values().next().value as string
    toLoad.delete(id)
    if (flowMap[id])
      continue
    const loaded = await resolveFlow(id)
    if (!loaded)
      continue
    flowMap[id] = loaded.flow
    collect(loaded.flow)
  }
  return flowMap
}

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

/** Config file names in resolution order (first existing wins). */
export const CONFIG_NAMES = ['runflow.config.mjs', 'runflow.config.js', 'runflow.config.json'] as const

/**
 * True when running in development mode (config/catalog should not be cached).
 * Uses NODE_ENV !== 'production' (so dev when undefined or 'development') or RUNFLOW_DEV=1.
 */
export function isDevelopment(): boolean {
  return (
    process.env.NODE_ENV !== 'production'
    || process.env.RUNFLOW_DEV === '1'
  )
}

/**
 * Return the first existing config file path in the given directory, or null.
 * Order: runflow.config.mjs, runflow.config.js, runflow.config.json.
 */
export function findConfigFile(cwd: string): string | null {
  for (const name of CONFIG_NAMES) {
    const p = path.join(cwd, name)
    if (existsSync(p) && statSync(p).isFile())
      return p
  }
  return null
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
      // In development, bust Node's ESM cache so viewer/consumers always get fresh config
      const url = isDevelopment()
        ? `${pathToFileURL(configPath).href}?t=${statSync(configPath).mtimeMs}`
        : pathToFileURL(configPath).href
      const mod = await import(url) as { default?: RunflowConfig }
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

export function resolveFlowId(
  flowId: string,
  config: RunflowConfig | null,
  configDir: string,
  cwd: string,
): ResolvedFlow {
  const handlers = config?.handlers
  if (handlers && typeof handlers === 'object') {
    const colonIndex = flowId.indexOf(':')
    if (colonIndex > 0 && colonIndex < flowId.length - 1) {
      const key = flowId.slice(0, colonIndex)
      const operation = flowId.slice(colonIndex + 1)
      const entry = Array.isArray(handlers)
        ? handlers.find(h => typeof h === 'object' && h.type === key)
        : (handlers as Record<string, string | OpenApiHandlerEntry>)[key]

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
  let filePath = path.isAbsolute(flowId) ? flowId : path.resolve(baseDir, flowId)

  // If file doesn't exist and has no extension, try adding .yaml
  if (!existsSync(filePath) && !path.extname(filePath)) {
    const withYaml = `${filePath}.yaml`
    if (existsSync(withYaml)) {
      filePath = withYaml
    }
  }

  return { type: 'file', path: filePath }
}

// --- Load flow (resolve + load) ---

export interface LoadedFlow {
  flow: FlowDefinition
  resolvedPath?: string
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
  return { flow, resolvedPath: resolved.path }
}

/**
 * Resolve flowId using a multi-step resolution strategy:
 * 1. Fast Path: Try direct file resolution (normalized path).
 * 2. Slow Path: Fall back to catalog lookup for custom IDs, normalized IDs, and OpenAPI handlers.
 * @throws Error with user-facing message when file/spec not found, operation not found, or flow invalid.
 */
export async function resolveAndLoadFlow(
  flowId: string,
  config: RunflowConfig | null,
  configDir: string,
  cwd: string,
): Promise<LoadedFlow> {
  // 1. Try direct resolution (Fast Path)
  const resolvedDirect = resolveFlowId(flowId, config, configDir, cwd)
  if (resolvedDirect.type === 'file' && existsSync(resolvedDirect.path) && statSync(resolvedDirect.path).isFile()) {
    try {
      return await loadFlowFromResolved(resolvedDirect, configDir)
    }
    catch {
      // If loading fails (e.g. invalid YAML), fall through to catalog for better error message
    }
  }

  // 2. Fall back to catalog lookup (Slow Path) for custom IDs or OpenAPI handlers
  try {
    const { buildDiscoverCatalog, getDiscoverEntry } = await import('./discover.js')
    const catalog = await buildDiscoverCatalog(config, configDir, cwd)
    const entry = getDiscoverEntry(catalog, flowId)

    if (entry) {
      let resolvedFlowId = flowId
      if (entry.handlerKey && entry.originalFlowId) {
        resolvedFlowId = entry.originalFlowId
      }
      else if (entry.path || entry.absPath) {
        resolvedFlowId = entry.path || entry.absPath!
      }
      else if (entry.originalFlowId) {
        resolvedFlowId = entry.originalFlowId
      }

      const resolved = resolveFlowId(resolvedFlowId, config, configDir, cwd)
      return loadFlowFromResolved(resolved, configDir)
    }
  }
  catch {
    // If catalog lookup fails, fall through to direct resolution
  }

  // Final fallback to direct resolution for clear error reporting
  return loadFlowFromResolved(resolvedDirect, configDir)
}

export function createResolveFlow(
  config: RunflowConfig | null,
  configDir: string,
  cwd: string,
): ResolveFlowFn {
  return async (flowId: string) => {
    try {
      const loaded = await resolveAndLoadFlow(flowId, config, configDir, cwd)
      return { flow: loaded.flow }
    }
    catch {
      return null
    }
  }
}

/**
 * Build a StepRegistry by merging built-in handlers with custom handlers from config.
 * Handles both module-based handlers and OpenAPI-based (default http) handlers.
 */
export async function buildRegistryFromConfig(config: RunflowConfig | null, configDir: string): Promise<StepRegistry> {
  const factoryContext = createFactoryContext()
  const allHandlerConfigs: HandlerConfig[] = builtinHandlers.map(f => f(factoryContext))

  if (!config?.handlers || (typeof config.handlers !== 'object'))
    return buildRegistry(allHandlerConfigs)

  const httpHandlerConfig = allHandlerConfigs.find(h => h.type === 'http')!

  const entries = Array.isArray(config.handlers)
    ? config.handlers.map(h => [undefined, h] as const)
    : Object.entries(config.handlers)

  for (const [typeInConfig, value] of entries) {
    if (typeof value === 'string') {
      const resolved = path.resolve(configDir, value)
      if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        const typeMsg = typeInConfig ? ` for type "${typeInConfig}"` : ''
        throw new Error(`Handler module not found${typeMsg}: ${resolved}`)
      }
      try {
        let mod: { default?: HandlerFactory }
        const ext = path.extname(resolved).toLowerCase()

        if (ext === '.ts') {
          const { tsImport } = await import('tsx/esm/api')
          mod = await tsImport(resolved, import.meta.url) as { default?: HandlerFactory }
        }
        else {
          const url = isDevelopment() ? `${pathToFileURL(resolved).href}?t=${statSync(resolved).mtimeMs}` : pathToFileURL(resolved).href
          mod = await import(url) as { default?: HandlerFactory }
        }

        const factory = mod.default
        if (typeof factory !== 'function') {
          throw new TypeError(`Handler module "${resolved}" must export default a HandlerFactory function.`)
        }
        const handlerConfig = factory(factoryContext)
        if (typeInConfig) {
          // Record format: override the internal type with the key from config
          allHandlerConfigs.push({ ...handlerConfig, type: typeInConfig })
        }
        else {
          allHandlerConfigs.push(handlerConfig)
        }
      }
      catch (e) {
        if (e instanceof Error && (e.message.includes('must export default') || e.message.includes('must export')))
          throw e
        continue
      }
      continue
    }

    if (!isOpenApiHandlerEntry(value))
      continue

    const type = typeInConfig || value.type
    if (!type) {
      throw new Error('OpenAPI handler entry must have a type (key in record or type property in array).')
    }

    if (value.handler) {
      const resolved = path.resolve(configDir, value.handler)
      if (!existsSync(resolved) || !statSync(resolved).isFile()) {
        throw new Error(`OpenAPI handler module not found for type "${type}": ${resolved}`)
      }
      try {
        let mod: { default?: HandlerFactory }
        const ext = path.extname(resolved).toLowerCase()

        if (ext === '.ts') {
          const { tsImport } = await import('tsx/esm/api')
          mod = await tsImport(resolved, import.meta.url) as { default?: HandlerFactory }
        }
        else {
          const url = isDevelopment() ? `${pathToFileURL(resolved).href}?t=${statSync(resolved).mtimeMs}` : pathToFileURL(resolved).href
          mod = await import(url) as { default?: HandlerFactory }
        }

        const factory = mod.default
        if (typeof factory !== 'function') {
          throw new TypeError(`OpenAPI handler module "${resolved}" must export default a HandlerFactory function.`)
        }
        allHandlerConfigs.push({ ...factory(factoryContext), type })
      }
      catch (e) {
        if (e instanceof Error && (e.message.includes('must export default') || e.message.includes('must export')))
          throw e
        continue
      }
    }
    else {
      // Use default http handler for this type
      allHandlerConfigs.push({ ...httpHandlerConfig, type })
    }
  }

  return buildRegistry(allHandlerConfigs)
}
