import type { IncomingMessage, ServerResponse } from 'node:http'
import type { BroadcastFunction } from '../src/types'
import path from 'node:path'
import {
  findConfigFile,
  loadConfig,
} from '@runflow/workspace'
import {
  handleGetDetail,
  handleGetGraph,
  handleGetList,
  handleGetStatus,
  handleGetTree,
  handlePostRun,
  sendJson,
} from './workspace-handlers'

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
      switch (pathname) {
        case '/api/workspace/status':
          await handleGetStatus(req, res, ctx)
          return
        case '/api/workspace/list':
          await handleGetList(req, res, ctx)
          return
        case '/api/workspace/tree':
          await handleGetTree(req, res, ctx)
          return
        case '/api/workspace/graph':
          await handleGetGraph(req, res, ctx, requestUrl.searchParams)
          return
        case '/api/workspace/detail':
          await handleGetDetail(req, res, ctx, requestUrl.searchParams)
          return
        case '/api/workspace/run':
          if (req.method === 'POST') {
            await handlePostRun(req, res, ctx)
            return
          }
          break
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
