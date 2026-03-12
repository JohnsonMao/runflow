import type { BroadcastFunction } from '@runflow/viewer'
import path from 'node:path'
import { reloadAndExecuteFlow, startViewerServer } from '@runflow/viewer'
import {
  findConfigFile,
  loadConfig,
  resolveAndLoadFlow,
} from '@runflow/workspace'
import open from 'open'

export interface DevOptions {
  port?: number
  open?: boolean
  config?: string
}

export async function runDev(flowPath: string, options: DevOptions): Promise<void> {
  const port = options.port || 4321
  const cwd = process.cwd()
  const configPath = options.config ? path.resolve(cwd, options.config) : findConfigFile(cwd)
  const config = configPath ? await loadConfig(configPath) : null
  const configDir = configPath ? path.dirname(configPath) : cwd

  const workspaceCtx = { cwd, configPath, configDir, config }

  let absoluteFlowPath: string
  try {
    const loaded = await resolveAndLoadFlow(flowPath, config, configDir, cwd)
    absoluteFlowPath = loaded.resolvedPath || path.resolve(cwd, flowPath)
  }
  catch (e) {
    console.error(`[Dev] Failed to resolve flow: ${flowPath}`, e)
    process.exit(1)
  }

  let lastParamsFromUI: Record<string, unknown> | undefined

  // Define broadcast proxy to avoid circular dependency / use before define
  let broadcast: BroadcastFunction = () => {}

  const reloadAndRunFlow = async (shouldRun = true, params?: Record<string, unknown>, targetFlowPath?: string): Promise<void> => {
    try {
      const activeFlowPath = targetFlowPath || flowPath
      console.log(`[Dev] ${shouldRun ? 'Running' : 'Reloading'} flow: ${activeFlowPath}`)
      const effectiveParams = params || lastParamsFromUI

      await reloadAndExecuteFlow(
        { ...workspaceCtx, broadcast },
        activeFlowPath,
        { params: effectiveParams, shouldBroadcast: true, skipRun: !shouldRun },
      )
    }
    catch (e) {
      console.error(`[Dev] Error in dev cycle:`, e)
      broadcast('ERROR', e instanceof Error ? e.message : String(e))
    }
  }

  // 1. Start Integrated Viewer Server with internal Watcher
  const viewerServer = await startViewerServer({
    port,
    workspaceCtx,
    watchPath: absoluteFlowPath,
    onChange: () => {
      // On save, just reload to update the graph/UI, don't run automatically
      reloadAndRunFlow(false).catch(e => console.error('[Dev] Watcher reload error:', e))
    },
  })

  // Assign the real broadcast function
  broadcast = (type, payload) => {
    viewerServer.broadcast(type, payload)
  }

  // Handle Initial Load (don't run yet, just resolve and cache/broadcast)
  await reloadAndRunFlow(false)

  if (options.open) {
    const viewerUrl = `http://localhost:${port}/?flowId=${encodeURIComponent(flowPath)}`
    console.log(`[Dev] Opening viewer: ${viewerUrl}`)
    await open(viewerUrl)
  }

  process.on('SIGINT', () => {
    viewerServer.close().catch(() => {})
    process.exit()
  })
}
