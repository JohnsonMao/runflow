import type { WebSocketMessage } from '../types'
import { useEffect, useRef, useState } from 'react'

export function useWebSocket(url: string | null, onMessage?: (message: WebSocketMessage) => void) {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const onMessageRef = useRef(onMessage)
  const shouldReconnectRef = useRef(true)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = (targetUrl: string) => {
    if (!targetUrl || !shouldReconnectRef.current) {
      return
    }

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    const fullUrl = targetUrl.startsWith('ws') ? targetUrl : `ws://${targetUrl}`

    try {
      const ws = new WebSocket(fullUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage
          if (onMessageRef.current) {
            onMessageRef.current(data)
          }
        }
        catch (e) {
          console.error(`[WS] Failed to parse message:`, e)
        }
      }

      ws.onclose = (event) => {
        setIsConnected(false)
        wsRef.current = null

        // Only reconnect if we should and it wasn't a clean close
        // Code 1000 = normal closure, don't reconnect
        // Code 1001 = going away, don't reconnect
        if (shouldReconnectRef.current && event.code !== 1000 && event.code !== 1001) {
          const delay = Math.min(1000 * (2 ** reconnectAttemptsRef.current), 30000) // Exponential backoff, max 30s
          reconnectAttemptsRef.current++
          // Capture targetUrl from closure for reconnection
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (shouldReconnectRef.current && targetUrl) {
              connect(targetUrl)
            }
          }, delay)
        }
      }

      ws.onerror = (error) => {
        console.error(`[WS] Error:`, error)
        setIsConnected(false)
        // Error will trigger onclose, which handles reconnection
      }
    }
    catch (e) {
      console.error('[WS] Failed to create WebSocket:', e)
      setIsConnected(false)
      // Retry connection after delay
      if (shouldReconnectRef.current) {
        const delay = Math.min(1000 * (2 ** reconnectAttemptsRef.current), 30000)
        reconnectAttemptsRef.current++
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (targetUrl) {
            connect(targetUrl)
          }
        }, delay)
      }
    }
  }

  useEffect(() => {
    if (!url) {
      setIsConnected(false)
      shouldReconnectRef.current = false
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      return
    }

    shouldReconnectRef.current = true
    reconnectAttemptsRef.current = 0
    connect(url)

    return () => {
      shouldReconnectRef.current = false
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [url])

  const sendMessage = (msg: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
    else {
      console.warn('[WS] Cannot send message: WebSocket is not open')
    }
  }

  return { isConnected, sendMessage }
}
