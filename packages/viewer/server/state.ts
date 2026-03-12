import type { Server } from 'node:http'
import type { WebSocket } from 'ws'
import type { BroadcastFunction, WebSocketMessagePayloads } from '../src/hooks/use-websocket'
import type { FlowGraphResponse } from '../src/types'
import { WebSocketServer } from 'ws'

export class ViewerState {
  private lastFlowReload: FlowGraphResponse | null = null
  private stepStatuses = new Map<string, string>()
  private wss: WebSocketServer

  constructor(server: Server) {
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

      ws.on('close', () => {
        setTimeout(() => {
          if (this.wss.clients.size === 0) {
            process.stdout.write(`[Viewer] All clients disconnected. Closing process...\n`)
            process.exit(0)
          }
        }, 1000)
      })

      ws.on('error', (error) => {
        console.error('[Viewer] WebSocket error:', error)
      })
    })
  }

  public broadcast: BroadcastFunction = (type, payload) => {
    if (type === 'FLOW_RELOAD') {
      this.lastFlowReload = payload as FlowGraphResponse
      this.stepStatuses.clear()
    }
    else if (type === 'STEP_STATE_CHANGE') {
      const stepPayload = payload as WebSocketMessagePayloads['STEP_STATE_CHANGE']
      this.stepStatuses.set(stepPayload.stepId, stepPayload.status)
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

  private send<T extends keyof WebSocketMessagePayloads>(
    ws: WebSocket,
    type: T,
    payload: WebSocketMessagePayloads[T],
  ) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type, payload }))
    }
  }

  public close() {
    this.wss.close()
  }
}
