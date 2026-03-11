import type { WebSocket } from 'ws'
import { WebSocketServer } from 'ws'

export interface ViewerStateOptions {
  onMessage?: (data: any) => void
  onConnection?: (send: (type: string, payload: any) => void) => void
}

export class ViewerState {
  private lastFlowReload: any = null
  private stepStatuses = new Map<string, string>()
  private wss: WebSocketServer

  constructor(server: any, private options: ViewerStateOptions = {}) {
    this.wss = new WebSocketServer({ server })
    this.setupWss()
  }

  private setupWss() {
    this.wss.on('connection', (ws: WebSocket) => {
      // Replay state to new client
      if (this.lastFlowReload) {
        this.send(ws, 'FLOW_RELOAD', this.lastFlowReload)
      }
      for (const [stepId, status] of this.stepStatuses.entries()) {
        this.send(ws, 'STEP_STATE_CHANGE', { stepId, status })
      }

      if (this.options.onConnection) {
        this.options.onConnection((type, payload) => this.send(ws, type, payload))
      }

      ws.on('message', (raw) => {
        if (this.options.onMessage) {
          try {
            const data = JSON.parse(raw.toString())
            this.options.onMessage(data)
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
          if (this.wss.clients.size === 0) {
            process.stdout.write(`[Viewer] All clients disconnected. Closing process...\n`)
            process.exit(0)
          }
        }, 1000)
      })
    })
  }

  public broadcast = (type: string, payload: any) => {
    if (type === 'FLOW_RELOAD') {
      this.lastFlowReload = payload
      this.stepStatuses.clear()
    }
    else if (type === 'STEP_STATE_CHANGE') {
      this.stepStatuses.set(payload.stepId, payload.status)
    }
    else if (type === 'FLOW_START') {
      this.stepStatuses.clear()
    }

    const message = JSON.stringify({ type, payload })
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(message)
      }
    }
  }

  private send(ws: WebSocket, type: string, payload: any) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type, payload }))
    }
  }

  public close() {
    this.wss.close()
  }
}
