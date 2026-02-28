import type { IncomingMessage, ServerResponse } from 'node:http'
import type { TreeNode } from '../src/types.js'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { run } from '@runflow/core'
import { createBuiltinRegistry } from '@runflow/handlers'
import {
  buildDiscoverCatalog,
  buildFlowMapForRun,
  buildRegistryFromConfig,
  createResolveFlow,
  findConfigFile,
  flowDefinitionToGraphForVisualization,
  getDiscoverEntry,
  loadConfig,
  mergeParamDeclarations,
  resolveAndLoadFlow,
} from '@runflow/workspace'

export interface WorkspaceContext {
  cwd: string
  configPath: string | null
  configDir: string
  config: Awaited<ReturnType<typeof loadConfig>>
}

/** Entry from discover catalog; compatible with workspace DiscoverEntry. */
export interface DiscoverEntryLike {
  flowId: string
  /** Flow display name (e.g. flow.name); used as tree node label when present. */
  name: string
}

export function buildTreeFromCatalog(catalog: DiscoverEntryLike[]): TreeNode[] {
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
  const runflowConfigPath = process.env.RUNFLOW_CONFIG_PATH
  const cwd = process.cwd()
  const configPath = runflowConfigPath?.trim()
    ? path.resolve(runflowConfigPath)
    : findConfigFile(cwd)
  const configDir = configPath ? path.dirname(configPath) : cwd
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
    const tree = buildTreeFromCatalog(catalog)
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
    const stepsSummary = loaded.flow.steps.map(s => ({
      id: s.id,
      type: s.type,
      ...(s.name != null && s.name !== '' ? { name: s.name } : {}),
      ...(s.description != null ? { description: s.description } : {}),
    }))
    sendJson(res, 200, {
      ...graph,
      nodes,
      flowName: loaded.flow.name,
      flowDescription: loaded.flow.description,
      flowId,
      params: mergeParamDeclarations(ctx.config?.params, loaded.flow.params),
      steps: stepsSummary,
    })
  }
  catch (err) {
    sendJson(res, 404, {
      error: err instanceof Error ? err.message : 'Flow not found or invalid',
    })
  }
}

async function handleDetail(
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
    const catalog = await buildDiscoverCatalog(ctx.config, ctx.configDir, ctx.cwd)
    const entry = getDiscoverEntry(catalog, flowId)
    if (!entry) {
      sendJson(res, 404, { error: `Flow not found: ${flowId}` })
      return
    }
    sendJson(res, 200, entry)
  }
  catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Failed to get flow detail',
    })
  }
}

function formatRunResult(result: Awaited<ReturnType<typeof run>>, flowName?: string): string {
  const status = result.success ? '**Success**' : '**Failed**'
  const name = flowName ?? 'Flow'
  const headline = `${status} — Flow "${name}" (${result.steps.length} step(s)).`
  const stepLines = result.steps.map((s) => {
    const badge = s.success ? '✓' : '✗'
    const extra: string[] = []
    if (!s.success && s.error)
      extra.push(`error: ${s.error}`)
    if (s.log?.trim())
      extra.push(`log: ${s.log.trim()}`)
    const suffix = extra.length ? ` — ${extra.join(' ')}` : ''
    return `- ${badge} ${s.stepId}${suffix}`
  })
  const stepsBlock = stepLines.length ? `\n\n${stepLines.join('\n')}` : ''
  if (!result.success) {
    const msg = result.error ?? 'Unknown error'
    const stepErrors = result.steps
      .filter(s => !s.success && s.error)
      .map(s => `- Step "${s.stepId}": ${s.error}`)
      .join('\n')
    return `${headline}\n\n${msg}${stepErrors ? `\n\n${stepErrors}` : ''}${stepsBlock}`
  }
  return `${headline}${stepsBlock}`
}

async function handleRun(
  ctx: WorkspaceContext,
  body: { flowId: string, params?: Record<string, unknown> },
  res: ServerResponse,
): Promise<void> {
  const { flowId, params } = body
  if (!flowId?.trim()) {
    sendJson(res, 400, { error: 'Missing flowId' })
    return
  }
  try {
    const loaded = await resolveAndLoadFlow(flowId, ctx.config, ctx.configDir, ctx.cwd)
    const resolveFlow = createResolveFlow(ctx.config, ctx.configDir, ctx.cwd)
    const flowMap = await buildFlowMapForRun(loaded.flow, resolveFlow)
    const effectiveParamsDeclaration = mergeParamDeclarations(ctx.config?.params, loaded.flow.params)
    const registry = ctx.config ? await buildRegistryFromConfig(ctx.config, ctx.configDir) : createBuiltinRegistry()
    const result = await run(loaded.flow, {
      registry,
      params: params && Object.keys(params).length > 0 ? params : undefined,
      effectiveParamsDeclaration: effectiveParamsDeclaration.length > 0 ? effectiveParamsDeclaration : undefined,
      flowMap: Object.keys(flowMap).length > 0 ? flowMap : undefined,
    })
    const text = formatRunResult(result, loaded.flow.name)
    sendJson(res, 200, { success: result.success, text })
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    sendJson(res, 500, { success: false, text: `Run error: ${message}` })
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim())
    return {}
  return JSON.parse(raw) as unknown
}

/** Connect-style middleware for /api/workspace/*. Export for use by custom server (e.g. Express SSR). */
export function createWorkspaceApiMiddleware(): (
  req: import('node:http').IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => void {
  return async (req, res, next) => {
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
    if (pathname === '/api/workspace/detail') {
      await handleDetail(ctx, requestUrl, res)
      return
    }
    if (pathname === '/api/workspace/run' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req) as { flowId?: string, params?: Record<string, unknown> }
        await handleRun(ctx, { flowId: body?.flowId ?? '', params: body?.params }, res)
      }
      catch {
        sendJson(res, 400, { success: false, text: 'Invalid JSON body' })
      }
      return
    }
    next()
  }
}
