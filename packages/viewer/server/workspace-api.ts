import type { IncomingMessage, ServerResponse } from 'node:http'
import type { BroadcastFunction } from '../src/hooks/use-websocket'
import { Buffer } from 'node:buffer'
import path from 'node:path'
import {
  buildDiscoverCatalog,
  buildTagTree,
  buildTreeFromCatalog,
  findConfigFile,
  flowDefinitionToGraphForVisualization,
  formatRunResult,
  getDiscoverEntry,
  loadConfig,
  mergeParamDeclarations,
  resolveAndLoadFlow,
  saveRunResult,
} from '@runflow/workspace'
import { reloadAndExecuteFlow } from './execution'

export interface WorkspaceContext {
  cwd: string
  configPath: string | null
  configDir: string
  config: Awaited<ReturnType<typeof loadConfig>>
  broadcast?: BroadcastFunction
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

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim())
    return {}
  return JSON.parse(raw)
}

/** Connect-style middleware for /api/workspace/*. Export for use by custom server (e.g. Express SSR). */
export function createWorkspaceApiMiddleware(injectedCtx?: WorkspaceContext | { broadcast: WorkspaceContext['broadcast'] }): (
  req: IncomingMessage,
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
    if (injectedCtx && 'cwd' in injectedCtx) {
      ctx = injectedCtx as WorkspaceContext
    }
    else {
      const { cwd, configPath, configDir } = resolveWorkspaceConfig()
      const config = configPath ? await loadConfig(configPath) : null
      ctx = { cwd, configPath, configDir, config, broadcast: injectedCtx?.broadcast }
    }

    try {
      if (pathname === '/api/workspace/status') {
        sendJson(res, 200, {
          workspaceRoot: ctx.cwd,
          configPath: ctx.configPath ?? null,
          configured: Boolean(ctx.configPath && ctx.config),
        })
        return
      }

      if (pathname === '/api/workspace/list') {
        const catalog = await buildDiscoverCatalog(ctx.config, ctx.configDir, ctx.cwd)
        sendJson(res, 200, { workspaceRoot: ctx.cwd, entries: catalog })
        return
      }

      if (pathname === '/api/workspace/tree') {
        const catalog = await buildDiscoverCatalog(ctx.config, ctx.configDir, ctx.cwd)
        const tree = buildTreeFromCatalog(catalog)
        const tagTree = buildTagTree(catalog)
        sendJson(res, 200, {
          workspaceRoot: ctx.cwd,
          configPath: ctx.configPath ?? null,
          tree,
          tagTree,
        })
        return
      }

      if (pathname === '/api/workspace/graph') {
        const flowId = requestUrl.searchParams.get('flowId')
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
        return
      }

      if (pathname === '/api/workspace/detail') {
        const flowId = requestUrl.searchParams.get('flowId')
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
        return
      }

      if (pathname === '/api/workspace/run' && req.method === 'POST') {
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
        return
      }

      next()
    }
    catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Internal Server Error',
      })
    }
  }
}
