import type { FlowStep } from '@runflow/core'
import type { FlowGraph, LoadedFlow } from '@runflow/workspace'
import path from 'node:path'
import { run } from '@runflow/core'
import { startViewerServer } from '@runflow/viewer'
import {
  buildFlowMapForRun,
  buildRegistryFromConfig,
  findConfigFile,
  flowDefinitionToGraphForVisualization,
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

interface ReloadPayload extends FlowGraph {
  flowId: string
  params: any[] // TODO: Replace with proper ParamDeclaration from core if available
}

export async function runDev(flowPath: string, options: DevOptions): Promise<void> {
  const port = options.port || 8080
  const cwd = process.cwd()
  const configPath = options.config ? path.resolve(cwd, options.config) : findConfigFile(cwd)
  const config = configPath ? await loadConfig(configPath) : null
  const configDir = configPath ? path.dirname(configPath) : cwd

  // resolveAndLoadFlow now handles catalog lookup internally, so we can use it directly
  const catalogResolver = async (id: string): Promise<LoadedFlow> => {
    return await resolveAndLoadFlow(id, config, configDir, cwd)
  }

  let initialLoaded: LoadedFlow
  let absoluteFlowPath: string
  try {
    initialLoaded = await catalogResolver(flowPath)
    absoluteFlowPath = initialLoaded.resolvedPath || path.resolve(cwd, flowPath)
  }
  catch (e) {
    console.error(`[Dev] Failed to resolve flow: ${flowPath}`, e)
    process.exit(1)
  }

  // Cache for replay on connection
  let currentGraph: FlowGraph | null = null
  let currentFlowId = ''
  let currentParams: any[] = []

  // Define broadcast before use
  let broadcast: (data: { type: string, payload: unknown }) => void = () => {}

  const reloadAndRunFlow = async (shouldRun = true): Promise<void> => {
    try {
      console.log(`[Dev] Reloading flow: ${flowPath}`)
      const loaded = await catalogResolver(absoluteFlowPath || flowPath)

      if (!loaded) {
        console.error(`[Dev] Failed to resolve flow: ${flowPath}`)
        return
      }

      // Update Cache
      currentGraph = flowDefinitionToGraphForVisualization(loaded.flow)
      currentFlowId = loaded.flow.id || flowPath
      currentParams = loaded.flow.params || []

      // Push DSL Update (Full Context)
      broadcast({
        type: 'FLOW_RELOAD',
        payload: {
          ...currentGraph,
          flowId: currentFlowId,
          params: currentParams,
        } as ReloadPayload,
      })

      if (!shouldRun)
        return

      // Prepare for Run
      const registry = await buildRegistryFromConfig(config, configDir)
      const flowMap = await buildFlowMapForRun(loaded.flow, id => catalogResolver(id).then(l => l?.flow ? { flow: l.flow } : null))

      // Run with Hooks
      broadcast({ type: 'FLOW_START', payload: { flowId: currentFlowId } })

      await run(loaded.flow, {
        registry,
        flowMap: Object.keys(flowMap).length > 0 ? flowMap : undefined,
        onStepStart: (stepId: string, _step: FlowStep) => {
          broadcast({ type: 'STEP_STATE_CHANGE', payload: { stepId, status: 'running' } })
        },
        onStepComplete: (stepId: string, result: any) => { // TODO: Import StepResult from core
          broadcast({
            type: 'STEP_STATE_CHANGE',
            payload: {
              stepId,
              status: result.success ? 'success' : 'failure',
              error: result.error,
              outputs: result.outputs,
            },
          })
        },
      })

      broadcast({ type: 'FLOW_COMPLETE', payload: null })
    }
    catch (e) {
      console.error(`[Dev] Error in dev cycle:`, e)
      broadcast({ type: 'ERROR', payload: e instanceof Error ? e.message : String(e) })
    }
  }

  // 1. Start Integrated Viewer Server
  const viewerServer = await startViewerServer({
    port,
    workspaceCtx: { cwd, configPath, configDir, config },
    onConnection: (send: (type: string, payload: unknown) => void) => {
      console.log(`[Dev] Client connected, replaying state`)
      if (currentGraph) {
        send('FLOW_RELOAD', {
          ...currentGraph,
          flowId: currentFlowId,
          params: currentParams,
        } as ReloadPayload)
      }
    },
    onMessage: (msg: { type: string }) => {
      if (msg.type === 'RUN') {
        console.log(`[Dev] Run requested from viewer`)
        reloadAndRunFlow(true).catch(e => console.error('[Dev] Run error:', e))
      }
    },
  })

  // Assign the real broadcast function
  broadcast = (data: { type: string, payload: unknown }) => {
    viewerServer.broadcast(data.type, data.payload)
  }

  // Handle Initial Load (don't run yet, just resolve and cache)
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
