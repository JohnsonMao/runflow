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
  let mockServer: any
  let state: ViewerState

  beforeEach(() => {
    vi.clearAllMocks()
    mockServer = {}
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
    ;(state as any).wss.clients.add(mockClient)

    state.broadcast('TEST_EVENT', { foo: 'bar' })

    expect(mockClient.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'TEST_EVENT', payload: { foo: 'bar' } }),
    )
  })

  it('should clear step statuses on FLOW_START', () => {
    state.broadcast('STEP_STATE_CHANGE', { stepId: '1', status: 'running' })
    expect((state as any).stepStatuses.size).toBe(1)

    state.broadcast('FLOW_START', { flowId: 'test' })
    expect((state as any).stepStatuses.size).toBe(0)
  })

  it('should update lastFlowReload on FLOW_RELOAD', () => {
    const payload = { nodes: [], edges: [] }
    state.broadcast('FLOW_RELOAD', payload)
    expect((state as any).lastFlowReload).toBe(payload)
  })
})
