import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import { buildRegistry, createFactoryContext, run } from '@runflow/core'
import { builtinHandlers } from '@runflow/handlers'
import {
  buildDiscoverCatalog,
  buildFlowMapForRun,
  buildRegistryFromConfig,
  buildTagTree,
  buildTreeFromCatalog,
  createResolveFlow,
  findConfigFile,
  flowDefinitionToGraphForVisualization,
  formatRunResult,
  getDiscoverEntry,
  loadConfig,
  mergeParamDeclarations,
  resolveAndLoadFlow,
  saveRunResult,
} from '@runflow/workspace'

export interface WorkspaceContext {
  cwd: string
  configPath: string | null
  configDir: string
  config: Awaited<ReturnType<typeof loadConfig>>
}

function resolveWorkspaceConfig(): { cwd: string, configPath: string | null, configDir: string } {
  const runflowConfigPath = process.env.RUNFLOW_CONFIG_PATH
  const cwd = process.cwd()
  const configPath = runflowConfigPath?.trim()
    ? path.resolve(runflowConfigPath)
    : findConfigFile(cwd)
  const configDir = configPath ? path.dirname(configPath) : cwd
  return { cwd, configPath, configDir }
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
    const tagTree = buildTagTree(catalog)
    sendJson(res, 200, {
      workspaceRoot: ctx.cwd,
      configPath: ctx.configPath ?? null,
      tree,
      tagTree,
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
    let registry
    if (ctx.config) {
      registry = await buildRegistryFromConfig(ctx.config, ctx.configDir)
    }
    else {
      const factoryContext = createFactoryContext()
      registry = buildRegistry(builtinHandlers.map(f => f(factoryContext)))
    }
    const result = await run(loaded.flow, {
      registry,
      params: params && Object.keys(params).length > 0 ? params : undefined,
      effectiveParamsDeclaration: effectiveParamsDeclaration.length > 0 ? effectiveParamsDeclaration : undefined,
      flowMap: Object.keys(flowMap).length > 0 ? flowMap : undefined,
    })
    saveRunResult(result, ctx.configDir)
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
export function createWorkspaceApiMiddleware(injectedCtx?: WorkspaceContext): (
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

    let ctx: WorkspaceContext
    if (injectedCtx) {
      ctx = injectedCtx
    }
    else {
      const { cwd, configPath, configDir } = resolveWorkspaceConfig()
      const config = configPath ? await loadConfig(configPath) : null
      ctx = { cwd, configPath, configDir, config }
    }

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
