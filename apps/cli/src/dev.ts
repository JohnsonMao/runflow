import type { LoadedFlow } from '@runflow/workspace'
import path from 'node:path'
import { reloadAndExecuteFlow, startViewerServer } from '@runflow/viewer'
import {
  findConfigFile,
  loadConfig,
  resolveAndLoadFlow,
} from '@runflow/workspace'
import { watch } from 'chokidar'
import open from 'open'

export interface DevOptions {
  port?: number
  open?: boolean
  config?: string
}

export async function runDev(flowPath: string, options: DevOptions): Promise<void> {
  const port = options.port || 8080
  const cwd = process.cwd()
  const configPath = options.config ? path.resolve(cwd, options.config) : findConfigFile(cwd)
  const config = configPath ? await loadConfig(configPath) : null
  const configDir = configPath ? path.dirname(configPath) : cwd

  const workspaceCtx = { cwd, configPath, configDir, config }

  // resolveAndLoadFlow now handles catalog lookup internally
  const catalogResolver = async (id: string): Promise<LoadedFlow> => {
    return await resolveAndLoadFlow(id, config, configDir, cwd)
  }

  let absoluteFlowPath: string
  try {
    const loaded = await catalogResolver(flowPath)
    absoluteFlowPath = loaded.resolvedPath || path.resolve(cwd, flowPath)
  }
  catch (e) {
    console.error(`[Dev] Failed to resolve flow: ${flowPath}`, e)
    process.exit(1)
  }

  let lastParamsFromUI: Record<string, unknown> | undefined

  // Define broadcast proxy to avoid circular dependency / use before define
  let broadcast: (type: string, payload: any) => void = () => {}

  const reloadAndRunFlow = async (shouldRun = true, params?: Record<string, unknown>): Promise<void> => {
    try {
      console.log(`[Dev] Reloading flow: ${flowPath}`)
      const effectiveParams = params || lastParamsFromUI

      await reloadAndExecuteFlow(
        { ...workspaceCtx, broadcast },
        flowPath,
        { params: effectiveParams, shouldBroadcast: true, skipRun: !shouldRun },
      )
    }
    catch (e) {
      console.error(`[Dev] Error in dev cycle:`, e)
      broadcast('ERROR', e instanceof Error ? e.message : String(e))
    }
  }

  // 1. Start Integrated Viewer Server
  const viewerServer = await startViewerServer({
    port,
    workspaceCtx,
    onConnection: () => {
      console.log(`[Dev] Client connected, replaying state`)
    },
    onMessage: (msg: { type: string, payload?: any }) => {
      if (msg.type === 'RUN') {
        console.log(`[Dev] Run requested from viewer`, msg.payload?.params ? 'with params' : 'without params')
        if (msg.payload?.params) {
          lastParamsFromUI = msg.payload.params
        }
        reloadAndRunFlow(true, msg.payload?.params).catch(e => console.error('[Dev] Run error:', e))
      }
    },
  })

  // Assign the real broadcast function
  broadcast = (type, payload) => {
    viewerServer.broadcast(type, payload)
  }

  // Handle Initial Load (don't run yet, just resolve and cache/broadcast)
  await reloadAndRunFlow(false)

  // Watcher
  console.log(`[Dev] Watching: ${absoluteFlowPath}`)
  const watcher = watch(absoluteFlowPath, {
    ignoreInitial: true,
  })

  watcher.on('change', () => {
    reloadAndRunFlow(true).catch(e => console.error('[Dev] Watcher reload error:', e))
  })

  if (options.open) {
    const viewerUrl = `http://localhost:${port}/?ws=localhost:${port}&flowId=${encodeURIComponent(flowPath)}`
    console.log(`[Dev] Opening viewer: ${viewerUrl}`)
    await open(viewerUrl)
  }

  process.on('SIGINT', () => {
    watcher.close().catch(() => {})
    viewerServer.close().catch(() => {})
    process.exit()
  })
}
