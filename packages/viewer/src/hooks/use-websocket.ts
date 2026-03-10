import { useEffect, useRef, useState } from 'react'

export interface WebSocketMessage {
  type: string
  payload?: any
}

export function useWebSocket(url: string | null) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!url) {
      setIsConnected(false)
      return
    }

    const fullUrl = url.startsWith('ws') ? url : `ws://${url}`

    const ws = new WebSocket(fullUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WebSocketMessage
        setLastMessage(data)
      }
      catch (e) {
        console.error(`[WS] Failed to parse message:`, e)
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
    }

    ws.onerror = (error) => {
      console.error(`[WS] Error:`, error)
      setIsConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [url])

  const sendMessage = (msg: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }

  return { isConnected, lastMessage, sendMessage }
}
