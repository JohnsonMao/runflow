import type { OpenApiToFlowsOptions, ParamExposeConfig } from '@runflow/convention-openapi'
import type { ParamDeclaration } from '@runflow/core'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const CONFIG_NAMES = ['runflow.config.mjs', 'runflow.config.js', 'runflow.config.json'] as const

/** Per-prefix OpenAPI entry: specPath and options. Paths resolved relative to config file directory. */
export interface OpenApiEntry {
  specPath: string
  baseUrl?: string
  operationFilter?: OpenApiToFlowsOptions['operationFilter']
  paramExpose?: ParamExposeConfig
  override?: string
  overrideStepType?: string
}

/** Keyed by prefix; flowId for OpenAPI flows is `${prefix}-${operationKey}` (e.g. my-api-get-users). */
export interface RunflowConfig {
  handlers?: Record<string, string>
  /** Directory to resolve file flowIds (relative to config dir). When set, flowId is relative to this. */
  flowsDir?: string
  /** OpenAPI specs by prefix. flowId = prefix-operation (e.g. my-api-get-users). */
  openapi?: Record<string, OpenApiEntry>
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
  specPath: string
  operation: string
  /** Resolved spec path for runner to inject into context (openApiSpecPath). */
  openApiSpecPath: string
  /** Operation key for runner to inject into context (openApiOperationKey). */
  openApiOperationKey: string
  options: Partial<OpenApiToFlowsOptions>
}

export type ResolvedFlow = ResolvedFileFlow | ResolvedOpenApiFlow

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
  const openapi = config?.openapi && typeof config.openapi === 'object' ? config.openapi : null
  if (openapi) {
    let best: { prefix: string, entry: OpenApiEntry } | null = null
    for (const [prefix, entry] of Object.entries(openapi)) {
      if (!entry || typeof entry.specPath !== 'string')
        continue
      if (flowId.startsWith(`${prefix}-`)) {
        const operation = flowId.slice(prefix.length + 1)
        if (operation && (!best || prefix.length > best.prefix.length))
          best = { prefix, entry }
      }
    }
    if (best) {
      const { prefix, entry } = best
      const operation = flowId.slice(prefix.length + 1)
      const specPath = path.isAbsolute(entry.specPath)
        ? entry.specPath
        : path.resolve(configDir, entry.specPath)
      const { specPath: _drop, ...options } = entry
      return {
        type: 'openapi',
        specPath,
        operation,
        openApiSpecPath: specPath,
        openApiOperationKey: operation,
        options,
      }
    }
  }
  const baseDir = config?.flowsDir
    ? path.resolve(configDir, config.flowsDir)
    : cwd
  const filePath = path.isAbsolute(flowId) ? flowId : path.resolve(baseDir, flowId)
  return { type: 'file', path: filePath }
}
