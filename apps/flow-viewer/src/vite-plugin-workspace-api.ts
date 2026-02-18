import type { FlowGraph } from '@runflow/core'
import type { ServerResponse } from 'node:http'
import type { PluginOption } from 'vite'
import type { TreeNode } from './types'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  buildDiscoverCatalog,
  CONFIG_NAMES,
  findConfigFile,
  flowDefinitionToGraphForVisualization,
  loadConfig,
  resolveAndLoadFlow,
} from '@runflow/workspace'

const WORKSPACE_ROOT_ENV = 'FLOW_VIEWER_WORKSPACE_ROOT'

export interface WorkspaceContext {
  cwd: string
  configPath: string | null
  configDir: string
  config: Awaited<ReturnType<typeof loadConfig>>
}

function isConfigFileName(name: string): boolean {
  return CONFIG_NAMES.includes(name as typeof CONFIG_NAMES[number])
}

export interface DiscoverEntryLike {
  flowId: string
  name: string
  openapiPrefix?: string
}

export function matchOpenApiPrefixFallback(flowId: string, prefixes: string[]): string | null {
  let matched: string | null = null
  for (const p of prefixes) {
    if (flowId.startsWith(`${p}-`))
      matched = !matched || p.length > matched.length ? p : matched
  }
  return matched
}

export function buildTreeFromCatalog(
  catalog: DiscoverEntryLike[],
  openapiPrefixes: string[] = [],
): TreeNode[] {
  const hasSlash = (s: string) => s.includes('/')
  const isFileFlowId = (s: string) => s.endsWith('.yaml') || s.endsWith('.yml') || hasSlash(s)
  const fileEntries = catalog.filter(e => isFileFlowId(e.flowId))
  const openApiLike = catalog.filter(e => !isFileFlowId(e.flowId))

  const roots: TreeNode[] = []

  const ensurePath = (parts: string[], flowId: string, name: string): void => {
    if (parts.length === 0)
      return
    if (parts.length === 1) {
      roots.push({
        id: `file:${flowId}`,
        label: parts[0],
        type: 'file',
        flowId,
        name,
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
        name,
      })
    }
  }

  for (const e of fileEntries) {
    const parts = e.flowId.split('/')
    ensurePath(parts, e.flowId, e.name)
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
    const byPrefix = new Map<string, DiscoverEntryLike[]>()
    for (const e of openApiLike) {
      const prefix = e.openapiPrefix ?? (openapiPrefixes.length > 0 ? matchOpenApiPrefixFallback(e.flowId, openapiPrefixes) : null)
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
          })),
        })
      }
    }
    openApiChildren.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    roots.push(...openApiChildren)
  }

  return roots
}

function resolveWorkspaceConfig(): { cwd: string, configPath: string | null, configDir: string } {
  const env = process.env[WORKSPACE_ROOT_ENV] || '../../examples'
  const base = env && env.trim() ? path.resolve(env) : process.cwd()

  if (existsSync(base) && statSync(base).isFile()) {
    if (isConfigFileName(path.basename(base))) {
      const configDir = path.dirname(base)
      return { cwd: configDir, configPath: base, configDir }
    }
  }

  let configPath = findConfigFile(base)
  if (!configPath && existsSync(base) && statSync(base).isDirectory()) {
    configPath = findConfigFile(path.join(base, 'config'))
  }
  const configDir = configPath ? path.dirname(configPath) : base
  return { cwd: configDir, configPath, configDir }
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

async function handleStatus(ctx: WorkspaceContext, res: ServerResponse): Promise<void> {
  sendJson(res, 200, {
    workspaceRoot: ctx.cwd,
    configPath: ctx.configPath ?? null,
    configured: Boolean(ctx.configPath && ctx.config),
  })
}

async function handleList(ctx: WorkspaceContext, res: ServerResponse): Promise<void> {
  try {
    const catalog = await buildDiscoverCatalog(ctx.config, ctx.configDir, ctx.cwd)
    sendJson(res, 200, { workspaceRoot: ctx.cwd, entries: catalog })
  }
  catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Failed to build catalog',
    })
  }
}

async function handleTree(ctx: WorkspaceContext, res: ServerResponse): Promise<void> {
  try {
    const catalog = await buildDiscoverCatalog(ctx.config, ctx.configDir, ctx.cwd)
    const openapiPrefixes = ctx.config?.openapi && typeof ctx.config.openapi === 'object'
      ? Object.keys(ctx.config.openapi)
      : []
    const tree = buildTreeFromCatalog(catalog, openapiPrefixes)
    sendJson(res, 200, {
      workspaceRoot: ctx.cwd,
      configPath: ctx.configPath ?? null,
      tree,
    })
  }
  catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Failed to build tree',
    })
  }
}

async function handleGraph(
  ctx: WorkspaceContext,
  requestUrl: URL,
  res: ServerResponse,
): Promise<void> {
  const flowId = requestUrl.searchParams.get('flowId')
  if (!flowId?.trim()) {
    sendJson(res, 400, { error: 'Missing flowId' })
    return
  }
  try {
    const loaded = await resolveAndLoadFlow(flowId, ctx.config, ctx.configDir, ctx.cwd)
    const graph = flowDefinitionToGraphForVisualization(loaded.flow)
    const stepById = new Map(loaded.flow.steps.map(s => [s.id, s]))
    const nodes = graph.nodes.map((n) => {
      const step = stepById.get(n.id)
      const name = step && typeof step.name === 'string' && step.name !== '' ? step.name : null
      return name ? { ...n, label: name } : n
    })
    const response: FlowGraph = { ...graph, nodes }
    sendJson(res, 200, {
      ...response,
      flowName: loaded.flow.name,
      flowDescription: loaded.flow.description,
    })
  }
  catch (err) {
    sendJson(res, 404, {
      error: err instanceof Error ? err.message : 'Flow not found or invalid',
    })
  }
}

export function workspaceApiPlugin(): PluginOption {
  return {
    name: 'runflow:workspace-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? ''
        let requestUrl: URL
        try {
          requestUrl = new URL(rawUrl, 'http://localhost')
        }
        catch {
          next()
          return
        }
        const pathname = requestUrl.pathname
        if (!pathname.startsWith('/api/workspace/')) {
          next()
          return
        }
        const { cwd, configPath, configDir } = resolveWorkspaceConfig()
        const config = configPath ? await loadConfig(configPath) : null
        const ctx: WorkspaceContext = { cwd, configPath, configDir, config }

        if (pathname === '/api/workspace/status') {
          await handleStatus(ctx, res)
          return
        }
        if (pathname === '/api/workspace/list') {
          await handleList(ctx, res)
          return
        }
        if (pathname === '/api/workspace/tree') {
          await handleTree(ctx, res)
          return
        }
        if (pathname === '/api/workspace/graph') {
          await handleGraph(ctx, requestUrl, res)
          return
        }
        next()
      })
    },
  }
}
