import type { ParamDeclaration } from '@runflow/core'
import type { RunflowConfig } from './config'
import { existsSync, lstatSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { openApiToFlows } from '@runflow/convention-openapi'
import { loadFromFile } from '@runflow/core'

export const DEFAULT_MAX_DEPTH = 32
export const DEFAULT_MAX_FILES = 1000
export const DEFAULT_DISCOVER_LIMIT = 10
export const MAX_DISCOVER_LIMIT = 10

/** Step summary for detail view (id, type, optional name/description). */
export interface DiscoverStepSummary {
  id: string
  type?: string
  name?: string
  description?: string
}

export interface DiscoverEntry {
  flowId: string
  name: string
  description?: string
  params?: ParamDeclaration[]
  /** Step summaries for detail view; when present, may include name/description. */
  steps?: DiscoverStepSummary[]
  openapiPrefix?: string
}

export interface FindFlowFilesOptions {
  allowedRoot?: string
  maxDepth?: number
  maxFiles?: number
}

export function findFlowFiles(
  baseDir: string,
  extensions: readonly string[],
  options: FindFlowFilesOptions = {},
): string[] {
  const base = path.resolve(baseDir)
  if (!existsSync(base))
    return []
  const stat = lstatSync(base)
  if (stat.isSymbolicLink() || !stat.isDirectory())
    return []
  const allowedRoot = options.allowedRoot != null ? path.resolve(options.allowedRoot) : undefined
  if (allowedRoot != null) {
    const rel = path.relative(allowedRoot, base)
    if (rel.startsWith('..') || path.isAbsolute(rel))
      return []
  }
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
  const out: string[] = []
  let stopped = false
  const walk = (d: string, depth: number) => {
    if (stopped || depth > maxDepth)
      return
    let entries: Array<{ name: string, isDirectory: () => boolean, isFile: () => boolean, isSymbolicLink: () => boolean }>
    try {
      entries = readdirSync(d, { withFileTypes: true }) as typeof entries
    }
    catch {
      return
    }
    for (const e of entries) {
      if (stopped)
        break
      if (e.isSymbolicLink())
        continue
      const name = String(e.name)
      const full = path.join(d, name)
      if (e.isDirectory() && name !== 'node_modules' && !name.startsWith('.')) {
        walk(full, depth + 1)
      }
      else if (e.isFile() && extensions.some(ext => name.toLowerCase().endsWith(ext))) {
        out.push(full)
        if (out.length >= maxFiles)
          stopped = true
      }
    }
  }
  walk(base, 0)
  return out
}

export async function buildDiscoverCatalog(
  config: RunflowConfig | null,
  configDir: string,
  cwd: string,
): Promise<DiscoverEntry[]> {
  const baseDir = config?.flowsDir ? path.resolve(configDir, config.flowsDir) : cwd
  const entries: DiscoverEntry[] = []
  const flowFiles = findFlowFiles(baseDir, ['.yaml'], {
    allowedRoot: baseDir,
    maxDepth: DEFAULT_MAX_DEPTH,
    maxFiles: DEFAULT_MAX_FILES,
  })
  for (const filePath of flowFiles) {
    const flow = loadFromFile(filePath)
    if (!flow)
      continue
    const flowId = path.relative(baseDir, filePath)
    entries.push({
      flowId: flowId || filePath,
      name: flow.name,
      description: flow.description,
      params: flow.params,
      steps: flow.steps.map(s => ({
        id: s.id,
        type: s.type,
        ...(s.name != null && s.name !== '' ? { name: s.name } : {}),
        ...(s.description != null ? { description: s.description } : {}),
      })),
    })
  }
  const openapi = config?.openapi && typeof config.openapi === 'object' ? config.openapi : null
  if (openapi) {
    for (const [prefix, entry] of Object.entries(openapi)) {
      if (!entry || typeof entry.specPath !== 'string')
        continue
      const specPath = path.isAbsolute(entry.specPath) ? entry.specPath : path.resolve(configDir, entry.specPath)
      if (!existsSync(specPath) || !statSync(specPath).isFile())
        continue
      try {
        const opts: Parameters<typeof openApiToFlows>[1] = { output: 'memory' }
        if (entry.baseUrl !== undefined)
          opts.baseUrl = entry.baseUrl
        if (entry.operationFilter !== undefined)
          opts.operationFilter = entry.operationFilter
        if (entry.hooks !== undefined)
          opts.hooks = entry.hooks
        const flows = await openApiToFlows(specPath, opts)
        for (const [operationKey, flow] of flows) {
          entries.push({
            flowId: `${prefix}-${operationKey}`,
            name: flow.name,
            description: flow.description,
            params: flow.params,
            steps: flow.steps.map(s => ({
              id: s.id,
              type: s.type,
              ...(s.name != null && s.name !== '' ? { name: s.name } : {}),
              ...(s.description != null ? { description: s.description } : {}),
            })),
            openapiPrefix: prefix,
          })
        }
      }
      catch {
        // skip failed prefix
      }
    }
  }
  return entries
}

/** Get a single discover entry by flowId from catalog. Returns JSON-serializable entry for apps to present as they like. */
export function getDiscoverEntry(catalog: DiscoverEntry[], flowId: string): DiscoverEntry | undefined {
  return catalog.find(e => e.flowId === flowId)
}
