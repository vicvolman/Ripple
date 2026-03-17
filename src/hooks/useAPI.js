import { useState, useEffect, useRef } from 'react'

const BASE_URL = 'http://localhost:8000'

function useFetch(url, options = {}) {
  const { pollInterval = null, skip = false } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const fetchData = async () => {
    if (skip || !url) return
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch(url, { signal: abortRef.current.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      if (err.name === 'AbortError') return
      // Graceful degradation — backend offline
      setData(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (skip || !url) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchData()

    let interval = null
    if (pollInterval) {
      interval = setInterval(fetchData, pollInterval)
    }

    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (interval) clearInterval(interval)
    }
  }, [url, skip, pollInterval])

  return { data, loading, error }
}

// GET /api/stats, polls every 30s
export function useStats() {
  return useFetch(`${BASE_URL}/api/stats`, { pollInterval: 30000 })
}

// GET /api/anomalies with filter params, polls every 15s
export function useAnomalies(filters = {}) {
  const params = new URLSearchParams()
  if (filters.types && filters.types.length > 0) {
    filters.types.forEach(t => params.append('type', t))
  }
  if (filters.minConfidence != null) params.set('min_confidence', filters.minConfidence / 100)
  if (filters.timeRange && filters.timeRange !== 'all') params.set('time_range', filters.timeRange)

  const query = params.toString()
  const url = `${BASE_URL}/api/anomalies${query ? `?${query}` : ''}`
  return useFetch(url, { pollInterval: 15000 })
}

// GET /api/metrics/volume?window=X, polls when window changes
export function useVolume(window = '24h') {
  return useFetch(`${BASE_URL}/api/metrics/volume?window=${encodeURIComponent(window)}`, {
    pollInterval: 30000,
  })
}

// GET /api/heatmap?metric=X
export function useHeatmap(metric = 'tx_count') {
  return useFetch(`${BASE_URL}/api/heatmap?metric=${encodeURIComponent(metric)}`)
}

// GET /api/address/{address}, only fetches when address is non-empty
export function useAddress(address) {
  const skip = !address || address.trim() === ''
  return useFetch(
    skip ? null : `${BASE_URL}/api/address/${encodeURIComponent(address.trim())}`,
    { skip }
  )
}

// GET /api/top-accounts
export function useTopAccounts() {
  return useFetch(`${BASE_URL}/api/top-accounts`)
}

// GET /api/ledger/{index}/transactions
export function useLedgerTransactions(ledgerIndex) {
  const skip = !ledgerIndex
  return useFetch(
    skip ? null : `${BASE_URL}/api/ledger/${ledgerIndex}/transactions`,
    { skip }
  )
}

// GET /api/analytics/tx-types
export function useTxTypes() {
  return useFetch(`${BASE_URL}/api/analytics/tx-types`)
}

// GET /api/analytics/wallet-pairs
export function useWalletPairs(limit = 10) {
  return useFetch(`${BASE_URL}/api/analytics/wallet-pairs?limit=${limit}`)
}

// GET /api/analytics/volume-series
export function useVolumeSeries() {
  return useFetch(`${BASE_URL}/api/analytics/volume-series`, { pollInterval: 60000 })
}

// GET /api/analytics/fee-stats
export function useFeeStats() {
  return useFetch(`${BASE_URL}/api/analytics/fee-stats`)
}

// GET /api/anomalies/distribution
export function useAnomalyDistribution() {
  return useFetch(`${BASE_URL}/api/anomalies/distribution`)
}
