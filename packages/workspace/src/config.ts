import type { OpenApiToFlowsOptions } from '@runflow/convention-openapi'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const CONFIG_NAMES = ['runflow.config.mjs', 'runflow.config.js', 'runflow.config.json'] as const

/** Per-prefix OpenAPI entry: specPath and options. Paths resolved relative to config file directory. */
export interface OpenApiEntry {
  specPath: string
  baseUrl?: string
  operationFilter?: OpenApiToFlowsOptions['operationFilter']
  hooks?: OpenApiToFlowsOptions['hooks']
}

/** Keyed by prefix; flowId for OpenAPI flows is `${prefix}-${operationKey}` (e.g. my-api-get-users). */
export interface RunflowConfig {
  handlers?: Record<string, string>
  /** Directory to resolve file flowIds (relative to config dir). When set, flowId is relative to this. */
  flowsDir?: string
  /** OpenAPI specs by prefix. flowId = prefix-operation (e.g. my-api-get-users). */
  openapi?: Record<string, OpenApiEntry>
  /**
   * Global default params merged into every flow run. Runner (CLI/MCP) merges as { ...params, ...callerParams }
   * so caller can override. Flow's declared params are still validated; extra keys from config are passed through to context.
   */
  params?: Record<string, unknown>
}

export interface ResolvedFileFlow {
  type: 'file'
  path: string
}

export interface ResolvedOpenApiFlow {
  type: 'openapi'
  specPath: string
  operation: string
  options: Partial<OpenApiToFlowsOptions>
}

export type ResolvedFlow = ResolvedFileFlow | ResolvedOpenApiFlow

export async function loadConfig(configPath: string): Promise<RunflowConfig | null> {
  if (!existsSync(configPath) || !statSync(configPath).isFile())
    return null
  if (configPath.endsWith('.json')) {
    try {
      const raw = readFileSync(configPath, 'utf-8')
      const data = JSON.parse(raw) as RunflowConfig
      return data && typeof data === 'object' ? data : null
    }
    catch {
      return null
    }
  }
  try {
    const mod = await import(pathToFileURL(configPath).href) as { default?: RunflowConfig }
    return mod.default ?? null
  }
  catch {
    return null
  }
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
      const options: Partial<OpenApiToFlowsOptions> = {}
      if (entry.baseUrl !== undefined)
        options.baseUrl = entry.baseUrl
      if (entry.operationFilter !== undefined)
        options.operationFilter = entry.operationFilter
      if (entry.hooks !== undefined)
        options.hooks = entry.hooks
      return { type: 'openapi', specPath, operation, options }
    }
  }
  const baseDir = config?.flowsDir
    ? path.resolve(configDir, config.flowsDir)
    : cwd
  const filePath = path.isAbsolute(flowId) ? flowId : path.resolve(baseDir, flowId)
  return { type: 'file', path: filePath }
}
