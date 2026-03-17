import { useState, useEffect, useRef, useCallback } from 'react'
import { connectToXRPL, getCurrentLedgerIndex } from '../utils/xrpl.js'

const MAX_TRANSACTIONS = 100
const TPS_WINDOW = 10000 // 10 seconds
const BASE_URL = 'http://localhost:8000'

// Resolve a meaningful "to" label for transactions that have no destination
function resolveDestination(t) {
  if (t.destination) return t.destination
  const type = t.tx_type || ''
  if (type === 'OfferCreate' || type === 'OfferCancel' || type === 'OfferDelete')
    return t.asset_pair ? `DEX · ${t.asset_pair}` : 'DEX'
  if (type.startsWith('NFToken')) return 'NFT'
  if (type === 'TrustSet') return 'TRUST LINE'
  if (type === 'AccountSet' || type === 'SetRegularKey') return t.account
  if (type === 'EscrowCreate' || type === 'EscrowFinish' || type === 'EscrowCancel') return 'ESCROW'
  if (type === 'AMMCreate' || type === 'AMMDeposit' || type === 'AMMWithdraw' || type === 'AMMVote') return 'AMM POOL'
  if (type === 'CheckCreate' || type === 'CheckCash' || type === 'CheckCancel') return 'CHECK'
  return 'LEDGER'
}

// Fetch real seed transactions from backend
async function fetchSeedTransactions() {
  try {
    const res = await fetch(`${BASE_URL}/api/transactions/recent?limit=50`)
    if (!res.ok) return []
    const data = await res.json()
    const items = data?.transactions ?? []
    return items.map((t, i) => {
      // amount_drops is XRP drops only when ≤ 1e13 (100M XRP); larger = token value
      const amount = (t.amount_drops != null && t.amount_drops <= 1e13)
        ? (t.amount_drops / 1_000_000)
        : (t.amount_drops != null ? t.amount_drops : null)

      // Currency: prefer asset_pair label, fallback to XRP for payments, empty for others
      const [baseCurrency] = t.asset_pair ? t.asset_pair.split('/') : []
      const currency = baseCurrency || (t.tx_type === 'Payment' ? 'XRP' : '')

      return {
        id: t.hash || `tx_${i}`,
        hash: t.hash || '',
        type: t.tx_type || 'Payment',
        from: t.account || '',
        to: resolveDestination(t),
        amount,
        currency,
        timestamp: t.timestamp || new Date().toISOString(),
        ledgerIndex: t.ledger_index || 0,
        fee: t.fee_drops != null ? (t.fee_drops / 1_000_000).toFixed(6) : '0.000012',
        status: 'validated',
        isAnomaly: !!t.is_anomaly,
        anomalyScore: t.anomaly_score ?? 0,
        anomalyType: t.anomaly_type || null,
      }
    })
  } catch {
    return []
  }
}

export function useXRPLStream() {
  const [transactions, setTransactions] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [isMockMode, setIsMockMode] = useState(false)
  const [ledgerIndex, setLedgerIndex] = useState(getCurrentLedgerIndex())
  const [tps, setTps] = useState(0)

  const disconnectRef = useRef(null)
  const txTimestampsRef = useRef([]) // for TPS calculation
  const txBufferRef = useRef([])
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
      // Seed with real backend data first
      const seed = await fetchSeedTransactions()
      if (mounted && seed.length > 0) {
        txBufferRef.current = seed
        setTransactions(seed)
      }

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
