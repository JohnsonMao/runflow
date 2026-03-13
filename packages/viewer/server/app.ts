import type { BroadcastFunction } from '../src/types'
import type { WorkspaceContext } from './workspace-api'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import polka from 'polka'
import sirv from 'sirv'
import { ViewerState } from './state'
import { createViteMiddleware } from './vite'
import { setupWatcher } from './watcher'
import { createWorkspaceApiMiddleware } from './workspace-api'

export interface ViewerServerOptions {
  port: number
  workspaceCtx?: WorkspaceContext
  staticPath?: string
  enableViteDev?: boolean
  /** Path to watch for changes. When a change occurs, the server will trigger a reload. */
  watchPath?: string
  /** Function to call when a watched file changes. If not provided, a default reload and broadcast will be performed if workspaceCtx is available. */
  onChange?: (path: string) => void
  /** If true, the server process will exit when all WebSocket clients have disconnected. */
  exitOnDisconnect?: boolean
}

export interface ViewerServer {
  port: number
  broadcast: BroadcastFunction
  close: () => Promise<void>
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(__dirname, '../')

export async function startViewerServer(options: ViewerServerOptions): Promise<ViewerServer> {
  const { port, workspaceCtx, enableViteDev, watchPath, onChange, exitOnDisconnect } = options

  const app = polka()
  const server = http.createServer(app.handler as unknown as http.RequestListener)

  const state = new ViewerState(server, { exitOnDisconnect })
  const broadcast = state.broadcast

  app.use(createWorkspaceApiMiddleware(workspaceCtx ? { ...workspaceCtx, broadcast } : { broadcast }))

  if (enableViteDev) {
    const viteMiddleware = await createViteMiddleware(appDir)
    app.use(viteMiddleware)
  }
  else {
    const defaultStaticPath = path.resolve(__dirname, '../')
    const staticPath = options.staticPath || defaultStaticPath
    app.use(sirv(staticPath, { single: true, dev: true }))
  }

  const watcher = setupWatcher({ watchPath, workspaceCtx, broadcast, onChange })

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      process.stdout.write(`[Viewer] Server started on http://localhost:${port}\n`)
      if (enableViteDev)
        process.stdout.write(`[Viewer] Running in Vite Dev Mode\n`)

      resolve({
        port,
        broadcast,
        close: async () => {
          watcher?.close()
          state.close()
          return new Promise(res => server.close(() => res()))
        },
      })
    })

    server.on('error', reject)
  })
}
