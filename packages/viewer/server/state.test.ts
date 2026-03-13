import type { Server } from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketServer } from 'ws'
import { ViewerState } from './state'

vi.mock('ws', () => {
  const WebSocketServer = vi.fn(() => ({
    on: vi.fn(),
    clients: new Set(),
    close: vi.fn(),
  }))
  return { WebSocketServer }
})

describe('viewerState', () => {
  let mockServer: Server
  let state: ViewerState

  beforeEach(() => {
    vi.clearAllMocks()
    mockServer = {} as Server
    state = new ViewerState(mockServer)
  })

  it('should initialize WebSocketServer', () => {
    expect(WebSocketServer).toHaveBeenCalledWith({ server: mockServer })
  })

  it('should broadcast messages to connected clients', () => {
    const mockClient = {
      readyState: 1, // Open
      send: vi.fn(),
    }
    // Accessing private wss for testing
    const wss = (state as unknown as { wss: { clients: Set<unknown> } }).wss
    wss.clients.add(mockClient)

    state.broadcast('ERROR', { foo: 'bar' })

    expect(mockClient.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ERROR', payload: { foo: 'bar' } }),
    )
  })

  it('should clear step statuses on FLOW_START', () => {
    state.broadcast('STEP_STATE_CHANGE', { stepId: '1', status: 'running' })
    const stepStatuses = (state as unknown as { stepStatuses: Map<string, string> }).stepStatuses
    expect(stepStatuses.size).toBe(1)

    state.broadcast('FLOW_START', { flowId: 'test' })
    expect(stepStatuses.size).toBe(0)
  })

  it('should update lastFlowReload on FLOW_RELOAD', () => {
    const payload = { nodes: [], edges: [], flowId: 'test-flow' }
    state.broadcast('FLOW_RELOAD', payload)
    const lastFlowReload = (state as unknown as { lastFlowReload: unknown }).lastFlowReload
    expect(lastFlowReload).toBe(payload)
  })

  it('should initialize with exitOnDisconnect option', () => {
    const stateWithExit = new ViewerState(mockServer, { exitOnDisconnect: true })
    const exitOnDisconnect = (stateWithExit as unknown as { exitOnDisconnect: boolean }).exitOnDisconnect
    expect(exitOnDisconnect).toBe(true)

    const stateNoExit = new ViewerState(mockServer, { exitOnDisconnect: false })
    const exitOnDisconnectNo = (stateNoExit as unknown as { exitOnDisconnect: boolean }).exitOnDisconnect
    expect(exitOnDisconnectNo).toBe(false)
  })
})
