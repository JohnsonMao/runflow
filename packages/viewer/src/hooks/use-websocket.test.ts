import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWebSocket } from './use-websocket'

describe('useWebSocket', () => {
  let mockWebSocket: any

  beforeEach(() => {
    vi.stubGlobal('WebSocket', vi.fn(() => {
      mockWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        readyState: 0,
      }
      return mockWebSocket
    }))
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('should connect to WebSocket on mount', () => {
    renderHook(() => useWebSocket('localhost:1234'))
    expect(globalThis.WebSocket).toHaveBeenCalledWith('ws://localhost:1234')
  })

  it('should handle isConnected state', () => {
    const { result } = renderHook(() => useWebSocket('localhost:1234'))
    expect(result.current.isConnected).toBe(false)

    act(() => {
      mockWebSocket.onopen()
    })
    expect(result.current.isConnected).toBe(true)

    act(() => {
      mockWebSocket.onclose({ code: 1000 })
    })
    expect(result.current.isConnected).toBe(false)
  })

  it('should call onMessage when receiving a message', () => {
    const onMessage = vi.fn()
    renderHook(() => useWebSocket('localhost:1234', onMessage))

    const msg = { type: 'FLOW_START', payload: { flowId: 'test' } }
    act(() => {
      mockWebSocket.onmessage({ data: JSON.stringify(msg) })
    })

    expect(onMessage).toHaveBeenCalledWith(msg)
  })

  it('should reconnect on non-clean close with exponential backoff', async () => {
    const { result } = renderHook(() => useWebSocket('localhost:1234'))

    act(() => {
      mockWebSocket.onopen()
    })
    expect(result.current.isConnected).toBe(true)

    // Simulate abnormal closure
    act(() => {
      mockWebSocket.onclose({ code: 1006 })
    })
    expect(result.current.isConnected).toBe(false)

    // Should not reconnect immediately
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(1)

    // Advance timers for first reconnect attempt (1s)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(globalThis.WebSocket).toHaveBeenCalledTimes(2)
  })
})
