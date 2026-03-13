import type { ViewerServer } from '@runflow/viewer'
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

  const reloadFlow = async (viewerServer: ViewerServer): Promise<void> => {
    await reloadAndExecuteFlow(
      { ...workspaceCtx, broadcast: viewerServer.broadcast },
      flowPath,
      { shouldBroadcast: true, skipRun: true },
    )
  }

  // 1. Start Integrated Viewer Server with internal Watcher
  const viewerServer = await startViewerServer({
    port,
    workspaceCtx,
    watchPath: absoluteFlowPath,
    onChange: () => reloadFlow(viewerServer),
  })

  await reloadFlow(viewerServer)

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
