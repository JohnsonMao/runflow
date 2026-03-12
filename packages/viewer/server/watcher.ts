import type { BroadcastFunction } from '../src/hooks/use-websocket'
import type { WorkspaceContext } from './workspace-api'
import { watch } from 'chokidar'

export interface WatcherOptions {
  watchPath?: string
  workspaceCtx?: WorkspaceContext
  broadcast: BroadcastFunction
  onChange?: (path: string) => void
}

export function setupWatcher(options: WatcherOptions) {
  const { watchPath, workspaceCtx, broadcast, onChange } = options
  if (!watchPath)
    return null

  process.stdout.write(`[Viewer] Watching for changes: ${watchPath}\n`)
  const watcher = watch(watchPath, { ignoreInitial: true })

  watcher.on('change', async (changedPath) => {
    process.stdout.write(`[Viewer] File changed: ${changedPath}\n`)
    if (onChange) {
      onChange(changedPath)
    }
    else if (workspaceCtx) {
      // Default reload logic if workspaceCtx is available
      const { reloadAndExecuteFlow } = await import('./execution.js')
      try {
        await reloadAndExecuteFlow(
          { ...workspaceCtx, broadcast },
          watchPath,
          { shouldBroadcast: true, skipRun: true },
        )
      }
      catch (e) {
        broadcast('ERROR', e instanceof Error ? e.message : String(e))
      }
    }
  })

  return watcher
}
