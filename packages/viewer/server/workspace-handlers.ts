import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WorkspaceContext } from './workspace-api'
import { Buffer } from 'node:buffer'
import {
  buildDiscoverCatalog,
  buildTagTree,
  buildTreeFromCatalog,
  flowDefinitionToGraphForVisualization,
  formatRunResult,
  getDiscoverEntry,
  mergeParamDeclarations,
  resolveAndLoadFlow,
  saveRunResult,
} from '@runflow/workspace'
import { reloadAndExecuteFlow } from './execution'

export function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim())
    return {}
  return JSON.parse(raw)
}

export async function handleGetStatus(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: WorkspaceContext,
): Promise<void> {
  sendJson(res, 200, {
    workspaceRoot: ctx.cwd,
    configPath: ctx.configPath ?? null,
    configured: Boolean(ctx.configPath && ctx.config),
  })
}

export async function handleGetList(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: WorkspaceContext,
): Promise<void> {
  const catalog = await buildDiscoverCatalog(ctx.config, ctx.configDir, ctx.cwd)
  sendJson(res, 200, { workspaceRoot: ctx.cwd, entries: catalog })
}

export async function handleGetTree(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: WorkspaceContext,
): Promise<void> {
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

export async function handleGetGraph(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: WorkspaceContext,
  query: URLSearchParams,
): Promise<void> {
  const flowId = query.get('flowId')
  if (!flowId?.trim()) {
    sendJson(res, 400, { error: 'Missing flowId' })
    return
  }
  const loaded = await resolveAndLoadFlow(flowId, ctx.config, ctx.configDir, ctx.cwd)
  const catalog = await buildDiscoverCatalog(ctx.config, ctx.configDir, ctx.cwd)
  const entry = getDiscoverEntry(catalog, flowId)
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
    ...(entry
      ? {
          originalFlowId: entry.originalFlowId,
          path: entry.path,
          absPath: entry.absPath,
          handlerKey: entry.handlerKey,
        }
      : {}),
    params: mergeParamDeclarations(ctx.config?.params, loaded.flow.params),
    steps: stepsSummary,
  })
}

export async function handleGetDetail(
  _req: IncomingMessage,
  res: ServerResponse,
  ctx: WorkspaceContext,
  query: URLSearchParams,
): Promise<void> {
  const flowId = query.get('flowId')
  if (!flowId?.trim()) {
    sendJson(res, 400, { error: 'Missing flowId' })
    return
  }
  const catalog = await buildDiscoverCatalog(ctx.config, ctx.configDir, ctx.cwd)
  const entry = getDiscoverEntry(catalog, flowId)
  if (!entry) {
    sendJson(res, 404, { error: `Flow not found: ${flowId}` })
    return
  }
  sendJson(res, 200, entry)
}

export async function handlePostRun(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: WorkspaceContext,
): Promise<void> {
  const body = (await readJsonBody(req)) as { flowId?: string, params?: Record<string, unknown> }
  const { flowId, params } = body
  if (!flowId?.trim()) {
    sendJson(res, 400, { error: 'Missing flowId' })
    return
  }
  const { loaded, result } = await reloadAndExecuteFlow(ctx, flowId, { params })
  if (!result) {
    sendJson(res, 500, { success: false, text: 'Execution failed: No result returned' })
    return
  }
  saveRunResult(result, ctx.configDir)
  const text = formatRunResult(result, loaded.flow.name)
  sendJson(res, 200, { success: result.success, text })
}
