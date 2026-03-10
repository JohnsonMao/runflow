import type { FlowStep, ParamDeclaration } from '@runflow/core'
import type { RunflowConfig } from './config'
import { existsSync, lstatSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { openApiToFlows } from '@runflow/convention-openapi'
import { isOpenApiHandlerEntry, mergeOpenApiSpecs, mergeParamDeclarations } from './config'
import { loadFromFile } from './loadFlow'

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
  /** Flow display name (from flow.name); used by UI as label. */
  name: string
  description?: string
  tags?: string[]
  error?: string
  /** Original relative file path (for Folder View navigation). */
  path?: string
  /** Absolute file path (for internal usage like dev watch). */
  absPath?: string
  params?: ParamDeclaration[]
  /** Step summaries for detail view; when present, may include name/description. */
  steps?: DiscoverStepSummary[]
}

export interface TreeNode {
  id: string
  label: string
  type: 'folder' | 'file'
  flowId?: string
  /** Original relative file path. */
  path?: string
  name?: string
  children?: TreeNode[]
  /** Optional error message from discover entry. */
  error?: string
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
  const idMap = new Map<string, string>() // flowId -> source

  const flowFiles = findFlowFiles(baseDir, ['.yaml'], {
    allowedRoot: baseDir,
    maxDepth: DEFAULT_MAX_DEPTH,
    maxFiles: DEFAULT_MAX_FILES,
  })
  for (const filePath of flowFiles) {
    const flow = loadFromFile(filePath)
    if (!flow)
      continue
    const rel = path.relative(baseDir, filePath)
    const flowId = flow.id || rel || filePath
    let error: string | undefined
    if (idMap.has(flowId)) {
      error = `Duplicate flowId: ${flowId} (already defined in ${idMap.get(flowId)})`
    }
    else {
      idMap.set(flowId, filePath)
    }
    entries.push({
      flowId,
      name: flow.name ?? (flowId || filePath),
      description: flow.description,
      tags: flow.tags,
      error,
      path: rel,
      absPath: filePath,
      params: mergeParamDeclarations(config?.params, flow.params),
      steps: flow.steps.map((s: FlowStep) => ({
        id: s.id,
        type: s.type,
        ...(s.name != null && s.name !== '' ? { name: s.name } : {}),
        ...(s.description != null ? { description: s.description } : {}),
      })),
    })
  }
  const handlers = config?.handlers && typeof config.handlers === 'object' ? config.handlers : null
  if (handlers) {
    for (const [key, entry] of Object.entries(handlers)) {
      if (!isOpenApiHandlerEntry(entry))
        continue
      const resolvedPaths = entry.specPaths.map(p => path.isAbsolute(p) ? p : path.resolve(configDir, p))
      const allExist = resolvedPaths.length > 0 && resolvedPaths.every(p => existsSync(p) && statSync(p).isFile())
      if (!allExist)
        continue
      try {
        const merged = await mergeOpenApiSpecs(resolvedPaths, configDir)
        const opts: Parameters<typeof openApiToFlows>[1] = {
          output: 'memory',
          stepType: key,
          baseUrl: entry.baseUrl,
          operationFilter: entry.operationFilter,
          paramExpose: entry.paramExpose,
        }
        const flows = await openApiToFlows(merged, opts)
        for (const [operationKey, flow] of flows) {
          const flowId = `${key}:${operationKey}`
          let error: string | undefined
          if (idMap.has(flowId)) {
            error = `Duplicate flowId: ${flowId} (already defined in ${idMap.get(flowId)})`
          }
          else {
            idMap.set(flowId, `handler:${key}`)
          }
          entries.push({
            flowId,
            name: flow.name ?? flowId,
            description: flow.description,
            tags: flow.tags,
            error,
            params: mergeParamDeclarations(config?.params, flow.params),
            steps: flow.steps.map((s: FlowStep) => ({
              id: s.id,
              type: s.type,
              ...(s.name != null && s.name !== '' ? { name: s.name } : {}),
              ...(s.description != null ? { description: s.description } : {}),
            })),
          })
        }
      }
      catch {
        // skip failed handler key
      }
    }
  }
  return entries
}

/** Get a single discover entry by flowId from catalog. Returns JSON-serializable entry for apps to present as they like. */
export function getDiscoverEntry(catalog: DiscoverEntry[], flowId: string): DiscoverEntry | undefined {
  return catalog.find(e => e.flowId === flowId)
}

export function buildTreeFromCatalog(catalog: DiscoverEntry[]): TreeNode[] {
  const fileEntries = catalog.filter(e => e.path != null)
  const openApiLike = catalog.filter(e => e.path == null)

  const roots: TreeNode[] = []

  const ensurePath = (parts: string[], flowId: string, name: string, error?: string, originalPath?: string): void => {
    if (parts.length === 0)
      return
    if (parts.length === 1) {
      roots.push({
        id: `file:${flowId}`,
        label: parts[0],
        type: 'file',
        flowId,
        path: originalPath,
        name,
        error,
      })
      return
    }
    let current = roots
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      const folderId = `folder:${parts.slice(0, i + 1).join('/')}`
      let folder = current.find((n): n is TreeNode => n.type === 'folder' && n.id === folderId)
      if (!folder) {
        folder = { id: folderId, label: part, type: 'folder', children: [] }
        current.push(folder)
        current = folder.children!
      }
      else {
        current = folder.children!
      }
    }
    const filePart = parts[parts.length - 1]
    if (!current.some(n => n.type === 'file' && n.flowId === flowId)) {
      current.push({
        id: `file:${flowId}`,
        label: filePart,
        type: 'file',
        flowId,
        path: originalPath,
        name,
        error,
      })
    }
  }

  for (const e of fileEntries) {
    const parts = e.path!.split('/')
    ensurePath(parts, e.flowId, e.name, e.error, e.path)
  }

  const sortNodes = (nodes: TreeNode[]): void => {
    nodes.sort((a, b) => {
      if (a.type !== b.type)
        return a.type === 'folder' ? -1 : 1
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    })
    nodes.forEach(n => n.children && sortNodes(n.children))
  }
  sortNodes(roots)

  if (openApiLike.length > 0) {
    const byPrefix = new Map<string, DiscoverEntry[]>()
    for (const e of openApiLike) {
      const colonIdx = e.flowId.indexOf(':')
      const prefix = colonIdx > 0 ? e.flowId.slice(0, colonIdx) : null
      const key = prefix ?? e.flowId
      const list = byPrefix.get(key) ?? []
      list.push(e)
      byPrefix.set(key, list)
    }
    const openApiChildren: TreeNode[] = []
    for (const [prefix, entries] of byPrefix.entries()) {
      if (entries.length === 1 && entries[0].flowId === prefix) {
        openApiChildren.push({
          id: `file:${entries[0].flowId}`,
          label: entries[0].name || entries[0].flowId,
          type: 'file',
          flowId: entries[0].flowId,
          name: entries[0].name,
          error: entries[0].error,
        })
      }
      else {
        openApiChildren.push({
          id: `openapi:${prefix}`,
          label: prefix,
          type: 'folder',
          children: entries.map(e => ({
            id: `file:${e.flowId}`,
            label: e.name || e.flowId,
            type: 'file' as const,
            flowId: e.flowId,
            name: e.name,
            error: e.error,
          })),
        })
      }
    }
    openApiChildren.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    roots.push(...openApiChildren)
  }

  return roots
}

export function buildTagTree(catalog: DiscoverEntry[]): TreeNode[] {
  const tagMap = new Map<string, DiscoverEntry[]>()
  const untagged: DiscoverEntry[] = []

  for (const entry of catalog) {
    if (entry.tags && entry.tags.length > 0) {
      for (const tag of entry.tags) {
        const list = tagMap.get(tag) ?? []
        list.push(entry)
        tagMap.set(tag, list)
      }
    }
    else {
      untagged.push(entry)
    }
  }

  const roots: TreeNode[] = []

  const sortedTags = Array.from(tagMap.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  for (const tag of sortedTags) {
    const entries = tagMap.get(tag)!
    roots.push({
      id: `tag:${tag}`,
      label: tag,
      type: 'folder',
      children: entries.map(e => ({
        id: `file:${e.flowId}`,
        label: e.name || e.flowId,
        type: 'file' as const,
        flowId: e.flowId,
        name: e.name,
        error: e.error,
      })).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    })
  }

  if (untagged.length > 0) {
    roots.push({
      id: 'tag:Untagged',
      label: 'Untagged',
      type: 'folder',
      children: untagged.map(e => ({
        id: `file:${e.flowId}`,
        label: e.name || e.flowId,
        type: 'file' as const,
        flowId: e.flowId,
        name: e.name,
        error: e.error,
      })).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
    })
  }

  return roots
}
