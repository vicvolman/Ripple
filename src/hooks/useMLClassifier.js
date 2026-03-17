import { useState, useEffect, useCallback, useRef } from 'react'
import {
  classifyTransaction,
  detectAnomaly,
  computeTypeDistribution,
  MODEL_METADATA,
} from '../utils/mlModels.js'

const MAX_ANOMALY_QUEUE = 20

export function useMLClassifier(transactions) {
  const [modelStats, setModelStats] = useState({
    ...MODEL_METADATA,
    typeDistribution: [],
    totalClassified: 0,
    anomalyRate: 0,
  })
  const [anomalyQueue, setAnomalyQueue] = useState([])
  const [classificationCache, setClassificationCache] = useState({})
  const processedHashesRef = useRef(new Set())

  // Classify a single transaction
  const classify = useCallback((tx, history = []) => {
    if (classificationCache[tx.id || tx.hash]) {
      return classificationCache[tx.id || tx.hash]
    }
    const result = classifyTransaction(tx, history)
    setClassificationCache(prev => ({
      ...prev,
      [tx.id || tx.hash]: result,
    }))
    return result
  }, [classificationCache])

  // Detect anomalies in a set of transactions
  const detectAnomalies = useCallback((txList, history = []) => {
    return txList.map(tx => ({
      tx,
      result: detectAnomaly(tx, history),
    }))
  }, [])

  // Process new transactions
  useEffect(() => {
    if (!transactions || transactions.length === 0) return

    const newTransactions = transactions.filter(
      tx => !processedHashesRef.current.has(tx.id || tx.hash)
    )

    if (newTransactions.length === 0) return

    newTransactions.forEach(tx => {
      processedHashesRef.current.add(tx.id || tx.hash)
    })

    // Detect anomalies in new transactions
    const newAnomalies = newTransactions
      .map(tx => {
        const anomalyResult = detectAnomaly(tx, transactions.slice(1, 50))
        return { ...tx, ...anomalyResult, detectedAt: new Date().toISOString() }
      })
      .filter(tx => tx.isAnomaly)

    if (newAnomalies.length > 0) {
      setAnomalyQueue(prev => {
        const combined = [...newAnomalies, ...prev]
        return combined.slice(0, MAX_ANOMALY_QUEUE)
      })
    }

    // Update model stats
    setModelStats(prev => {
      const dist = computeTypeDistribution(transactions)
      const anomalyCount = transactions.filter(tx => tx.isAnomaly).length
      const anomalyRate = Math.round((anomalyCount / Math.max(transactions.length, 1)) * 1000) / 10

      return {
        ...prev,
        typeDistribution: dist,
        totalClassified: prev.totalClassified + newTransactions.length,
        anomalyRate,
        lastUpdated: new Date().toISOString(),
      }
    })
  }, [transactions])

  // Dismiss an anomaly from the queue
  const dismissAnomaly = useCallback((anomalyId) => {
    setAnomalyQueue(prev => prev.filter(a => (a.id || a.hash) !== anomalyId))
  }, [])

  // Dismiss all anomalies
  const clearAnomalyQueue = useCallback(() => {
    setAnomalyQueue([])
  }, [])

  return {
    classify,
    detectAnomalies,
    modelStats,
    anomalyQueue,
    dismissAnomaly,
    clearAnomalyQueue,
  }
}
