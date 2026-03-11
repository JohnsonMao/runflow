import type { WorkspaceContext } from '../workspace-api'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { watch } from 'chokidar'
import polka from 'polka'
import sirv from 'sirv'
import { createServer as createViteServer } from 'vite'
import { WebSocketServer } from 'ws'
import { createWorkspaceApiMiddleware } from '../workspace-api'

export * from '../execution'

export interface ViewerServerOptions {
  port: number
  workspaceCtx?: WorkspaceContext
  staticPath?: string
  enableViteDev?: boolean
  /** Path to watch for changes. When a change occurs, the server will trigger a reload. */
  watchPath?: string
  /** Function to call when a watched file changes. If not provided, a default reload and broadcast will be performed if workspaceCtx is available. */
  onChange?: (path: string) => void
  /** Called when a new WebSocket client connects. Host can use the provided send function to push initial state. */
  onConnection?: (send: (type: string, payload: any) => void) => void
  /** Called when a message is received from a WebSocket client. */
  onMessage?: (data: any) => void
}

export interface ViewerServer {
  port: number
  broadcast: (type: string, payload: unknown) => void
  close: () => Promise<void>
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(__dirname, '../../') // Points to packages/viewer

export async function startViewerServer(options: ViewerServerOptions): Promise<ViewerServer> {
  const { port, workspaceCtx, enableViteDev, onConnection, onMessage, watchPath, onChange } = options

  // 1. Setup Polka & HTTP Server & WebSocket Server
  const app = polka()
  const server = http.createServer(app.handler as any)
  const wss = new WebSocketServer({ server })

  let lastFlowReload: any = null
  const stepStatuses = new Map<string, string>()

  const broadcast = (type: string, payload: any) => {
    if (type === 'FLOW_RELOAD') {
      lastFlowReload = payload
      stepStatuses.clear()
    }
    else if (type === 'STEP_STATE_CHANGE') {
      stepStatuses.set(payload.stepId, payload.status)
    }
    else if (type === 'FLOW_START') {
      stepStatuses.clear()
    }

    const message = JSON.stringify({ type, payload })
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(message)
      }
    }
  }

  // 2. Workspace API Middleware
  app.use(createWorkspaceApiMiddleware(workspaceCtx ? { ...workspaceCtx, broadcast } : { broadcast }))

  // 3. Static Assets / Vite Dev
  if (enableViteDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
      root: appDir,
    })

    app.use(vite.middlewares)

    app.use((req, res, next) => {
      if (res.writableEnded)
        return next()
      const url = req.url
      try {
        const template = fs.readFileSync(path.resolve(appDir, 'index.html'), 'utf-8')
        vite.transformIndexHtml(url, template).then((html) => {
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
        }).catch((e) => {
          vite.ssrFixStacktrace(e as Error)
          next(e)
        })
      }
      catch (e) {
        next(e)
      }
    })
  }
  else {
    const defaultStaticPath = path.resolve(__dirname, '../../')
    const staticPath = options.staticPath || defaultStaticPath

    const serve = sirv(staticPath, {
      single: true,
      dev: true,
    })
    app.use(serve)
  }

  // 4. Setup WebSocket Handlers
  wss.on('connection', (ws) => {
    // Replay state to new client
    if (lastFlowReload) {
      ws.send(JSON.stringify({ type: 'FLOW_RELOAD', payload: lastFlowReload }))
    }
    for (const [stepId, status] of stepStatuses.entries()) {
      ws.send(JSON.stringify({ type: 'STEP_STATE_CHANGE', payload: { stepId, status } }))
    }

    if (onConnection) {
      const send = (type: string, payload: any) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type, payload }))
        }
      }
      onConnection(send)
    }

    ws.on('message', (raw) => {
      if (onMessage) {
        try {
          const data = JSON.parse(raw.toString())
          onMessage(data)
        }
        catch {
          // Ignore invalid JSON
        }
      }
    })

    ws.on('close', () => {
      // If no more clients, wait a bit and then exit if still no clients
      // This handles page refreshes gracefully
      setTimeout(() => {
        if (wss.clients.size === 0) {
          process.stdout.write(`[Viewer] All clients disconnected. Closing process...\n`)
          process.exit(0)
        }
      }, 1000)
    })
  })

  // 5. Setup File Watcher
  let watcher: ReturnType<typeof watch> | null = null
  if (watchPath) {
    process.stdout.write(`[Viewer] Watching for changes: ${watchPath}\n`)
    watcher = watch(watchPath, { ignoreInitial: true })
    watcher.on('change', async (changedPath) => {
      process.stdout.write(`[Viewer] File changed: ${changedPath}\n`)
      if (onChange) {
        onChange(changedPath)
      }
      else if (workspaceCtx) {
        // Default reload logic if workspaceCtx is available
        const { reloadAndExecuteFlow } = await import('../execution.js')
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
  }

  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      process.stdout.write(`[Viewer] Server started on http://localhost:${port}\n`)
      if (enableViteDev) {
        process.stdout.write(`[Viewer] Running in Vite Dev Mode\n`)
      }

      resolve({
        port,
        broadcast,
        close: () => new Promise((res) => {
          watcher?.close().catch(() => {})
          wss.close()
          server.close(() => res())
        }),
      })
    })

    server.on('error', reject)
  })
}
