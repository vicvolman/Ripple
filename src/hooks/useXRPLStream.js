import { useState, useEffect, useRef, useCallback } from 'react'
import { connectToXRPL, getCurrentLedgerIndex } from '../utils/xrpl.js'
import { HISTORICAL_TRANSACTIONS } from '../utils/mockData.js'

const MAX_TRANSACTIONS = 100
const TPS_WINDOW = 10000 // 10 seconds

export function useXRPLStream() {
  const [transactions, setTransactions] = useState(() => HISTORICAL_TRANSACTIONS.slice(0, 20))
  const [isConnected, setIsConnected] = useState(false)
  const [isMockMode, setIsMockMode] = useState(true)
  const [ledgerIndex, setLedgerIndex] = useState(getCurrentLedgerIndex())
  const [tps, setTps] = useState(0)

  const disconnectRef = useRef(null)
  const txTimestampsRef = useRef([]) // for TPS calculation
  const txBufferRef = useRef([...HISTORICAL_TRANSACTIONS.slice(0, 20)])
  const tpsIntervalRef = useRef(null)

  // TPS calculation
  const updateTPS = useCallback(() => {
    const now = Date.now()
    const cutoff = now - TPS_WINDOW
    txTimestampsRef.current = txTimestampsRef.current.filter(t => t > cutoff)
    const currentTps = txTimestampsRef.current.length / (TPS_WINDOW / 1000)
    setTps(Math.round(currentTps * 10) / 10)
  }, [])

  const handleNewTransaction = useCallback((tx, newLedgerIndex) => {
    // Record timestamp for TPS
    txTimestampsRef.current.push(Date.now())

    if (newLedgerIndex) {
      setLedgerIndex(newLedgerIndex)
    }

    // Add to buffer maintaining rolling window
    txBufferRef.current = [tx, ...txBufferRef.current].slice(0, MAX_TRANSACTIONS)

    setTransactions(prev => [tx, ...prev].slice(0, MAX_TRANSACTIONS))
  }, [])

  const handleStatusChange = useCallback(({ connected, isMockMode: mock, ledgerIndex: idx }) => {
    setIsConnected(connected)
    setIsMockMode(mock)
    if (idx) setLedgerIndex(idx)
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const { disconnect } = await connectToXRPL(
          (tx, ledger) => {
            if (mounted) handleNewTransaction(tx, ledger)
          },
          (status) => {
            if (mounted) handleStatusChange(status)
          }
        )
        disconnectRef.current = disconnect
      } catch (err) {
        console.error('[useXRPLStream] Connection error:', err)
        if (mounted) {
          setIsMockMode(true)
          setIsConnected(false)
        }
      }
    }

    init()

    // TPS update interval
    tpsIntervalRef.current = setInterval(updateTPS, 1000)

    return () => {
      mounted = false
      if (disconnectRef.current) disconnectRef.current()
      if (tpsIntervalRef.current) clearInterval(tpsIntervalRef.current)
    }
  }, [])

  // Reconnect function
  const reconnect = useCallback(async () => {
    if (disconnectRef.current) disconnectRef.current()

    const { disconnect } = await connectToXRPL(
      handleNewTransaction,
      handleStatusChange
    )
    disconnectRef.current = disconnect
  }, [handleNewTransaction, handleStatusChange])

  return {
    transactions,
    isConnected,
    isMockMode,
    ledgerIndex,
    tps,
    reconnect,
    transactionCount: transactions.length,
  }
}
