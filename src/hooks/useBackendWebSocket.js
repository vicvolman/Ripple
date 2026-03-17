import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = 'ws://localhost:8000/ws/live'
const RECONNECT_DELAY = 3000
const MAX_LEDGER_UPDATES = 100
const MAX_RECENT_ANOMALIES = 50

export function useBackendWebSocket() {
  const [latestMessage, setLatestMessage] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [ledgerUpdates, setLedgerUpdates] = useState([])
  const [recentAnomalies, setRecentAnomalies] = useState([])

  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current && wsRef.current.readyState < 2) {
      // Already connecting or open
      return
    }

    let ws
    try {
      ws = new WebSocket(WS_URL)
    } catch {
      // WebSocket constructor can throw if URL is invalid or protocol unsupported
      scheduleReconnect()
      return
    }

    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setIsConnected(true)
      // Clear any pending reconnect
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(event.data)
        setLatestMessage(msg)

        if (msg.type === 'hello') {
          // Server greeting — nothing special to store
        } else if (msg.type === 'ledger_update') {
          setLedgerUpdates(prev => [msg, ...prev].slice(0, MAX_LEDGER_UPDATES))
        } else if (msg.type === 'anomaly_alert') {
          setRecentAnomalies(prev => [msg, ...prev].slice(0, MAX_RECENT_ANOMALIES))
        }
      } catch {
        // Non-JSON message — ignore gracefully
      }
    }

    ws.onerror = () => {
      // Errors will trigger onclose
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setIsConnected(false)
      wsRef.current = null
      scheduleReconnect()
    }
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return
    if (reconnectTimerRef.current) return
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      if (mountedRef.current) connect()
    }, RECONNECT_DELAY)
  }, [connect])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null // prevent reconnect on intentional close
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  return { latestMessage, isConnected, ledgerUpdates, recentAnomalies }
}
