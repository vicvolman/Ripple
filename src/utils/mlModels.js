// ML Models utility - Isolation Forest + Random Forest mock implementation

export const MODEL_METADATA = {
  name: 'Isolation Forest + Random Forest',
  version: '2.1.4',
  features: 8,
  accuracy: 0.963,
  precision: 0.948,
  recall: 0.971,
  f1Score: 0.959,
  lastTrained: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
  trainingSize: 50000,
  anomalyThreshold: parseFloat(import.meta.env?.VITE_ANOMALY_THRESHOLD || '0.65'),
}

// Feature extraction from transaction
function extractFeatures(tx, history = []) {
  const amount = parseFloat(tx.amount) || 0

  // Feature 1: Log-normalized amount
  const logAmount = amount > 0 ? Math.log10(amount + 1) : 0

  // Feature 2: Amount z-score relative to history
  const amounts = history.map(t => parseFloat(t.amount) || 0)
  const mean = amounts.length > 0
    ? amounts.reduce((a, b) => a + b, 0) / amounts.length
    : 500
  const variance = amounts.length > 0
    ? amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length
    : 10000
  const stdDev = Math.sqrt(variance) || 1
  const amountZScore = Math.abs((amount - mean) / stdDev)

  // Feature 3: Transaction velocity (tx per minute from same address)
  const now = new Date(tx.timestamp || Date.now())
  const oneMinuteAgo = new Date(now - 60000)
  const recentFromSame = history.filter(t =>
    t.from === tx.from && new Date(t.timestamp) > oneMinuteAgo
  ).length
  const velocity = recentFromSame

  // Feature 4: Type encoding
  const typeMap = { Payment: 0, EscrowCreate: 1, EscrowFinish: 2, EscrowCancel: 3, OfferCreate: 4, OfferDelete: 5, TrustSet: 6, AccountSet: 7 }
  const typeEncoded = (typeMap[tx.type] || 0) / 7

  // Feature 5: Hour of day (cyclical)
  const hour = now.getHours()
  const hourSin = Math.sin(2 * Math.PI * hour / 24)
  const hourCos = Math.cos(2 * Math.PI * hour / 24)

  // Feature 6: Destination frequency (how often has this destination appeared)
  const destFreq = history.filter(t => t.to === tx.to).length / Math.max(history.length, 1)

  // Feature 7: Amount percentile
  const sortedAmounts = [...amounts].sort((a, b) => a - b)
  const percentile = sortedAmounts.filter(a => a <= amount).length / Math.max(sortedAmounts.length, 1)

  return {
    logAmount,
    amountZScore,
    velocity,
    typeEncoded,
    hourSin,
    hourCos,
    destFreq,
    percentile,
  }
}

// Isolation Forest-like anomaly scoring
function isolationScore(features) {
  const { amountZScore, velocity, logAmount, percentile } = features

  // High amount z-score increases anomaly probability
  let score = 0

  // Z-score contribution (normalized)
  const zContrib = Math.min(amountZScore / 10, 0.5)

  // Velocity contribution
  const velContrib = Math.min(velocity / 20, 0.3)

  // Extreme percentile contribution
  const percContrib = percentile > 0.97 ? (percentile - 0.97) * 10 * 0.2 : 0

  // Very low amount contribution
  const lowAmountContrib = logAmount < 0.1 && velocity > 5 ? 0.15 : 0

  score = zContrib + velContrib + percContrib + lowAmountContrib

  // Add small random noise to simulate real model variance
  score += (Math.random() - 0.5) * 0.05

  return Math.max(0, Math.min(1, score))
}

// Random Forest classification
function randomForestClassify(features, txType) {
  // Simulate RF confidence based on features
  const baseConfidence = 0.75 + Math.random() * 0.2

  // Type-specific adjustments
  const typeConfidence = {
    Payment: 0.95,
    EscrowCreate: 0.88,
    EscrowFinish: 0.91,
    EscrowCancel: 0.85,
    OfferCreate: 0.82,
    OfferDelete: 0.79,
    TrustSet: 0.87,
    AccountSet: 0.83,
  }

  const typeAdj = typeConfidence[txType] || 0.80
  const confidence = Math.min(0.99, baseConfidence * typeAdj)

  return {
    predictedType: txType,
    confidence: Math.round(confidence * 1000) / 1000,
    alternatives: generateAlternatives(txType, confidence),
  }
}

function generateAlternatives(mainType, mainConf) {
  const allTypes = ['Payment', 'EscrowCreate', 'OfferCreate', 'TrustSet']
  const remaining = 1 - mainConf
  return allTypes
    .filter(t => t !== mainType)
    .slice(0, 2)
    .map((type, i) => ({
      type,
      confidence: Math.round((remaining / (i + 2)) * 1000) / 1000,
    }))
}

// Main classification function
export function classifyTransaction(tx, history = []) {
  const features = extractFeatures(tx, history)
  const rfResult = randomForestClassify(features, tx.type)

  return {
    type: rfResult.predictedType,
    confidence: rfResult.confidence,
    alternatives: rfResult.alternatives,
    features: {
      logAmount: Math.round(features.logAmount * 1000) / 1000,
      amountZScore: Math.round(features.amountZScore * 1000) / 1000,
      velocity: features.velocity,
      typeEncoded: Math.round(features.typeEncoded * 1000) / 1000,
      hourSin: Math.round(features.hourSin * 1000) / 1000,
      hourCos: Math.round(features.hourCos * 1000) / 1000,
      destFreq: Math.round(features.destFreq * 1000) / 1000,
      percentile: Math.round(features.percentile * 1000) / 1000,
    },
    modelVersion: MODEL_METADATA.version,
  }
}

// Main anomaly detection function
export function detectAnomaly(tx, history = []) {
  const features = extractFeatures(tx, history)
  const score = isolationScore(features)
  const threshold = MODEL_METADATA.anomalyThreshold

  const isAnomaly = score > threshold || (tx.isAnomaly === true)
  const finalScore = tx.isAnomaly ? Math.max(score, tx.anomalyScore || 0.7) : score

  let reason = null
  let anomalyType = tx.anomalyType || null

  if (isAnomaly) {
    if (features.amountZScore > 3) {
      reason = `Volume spike: amount is ${features.amountZScore.toFixed(1)}σ above mean`
      anomalyType = anomalyType || 'volume_spike'
    } else if (features.velocity > 10) {
      reason = `Rapid-fire: ${features.velocity} transactions/min from same address`
      anomalyType = anomalyType || 'rapid_fire'
    } else if (features.destFreq < 0.01 && features.percentile > 0.95) {
      reason = `Suspicious transfer to rare destination with high value`
      anomalyType = anomalyType || 'circular_transfer'
    } else if (tx.type === 'EscrowCreate' && features.amountZScore > 2) {
      reason = `Unusual escrow amount detected`
      anomalyType = anomalyType || 'escrow_manipulation'
    } else {
      reason = `Isolation Forest score ${finalScore.toFixed(3)} exceeds threshold ${threshold}`
      anomalyType = anomalyType || 'volume_spike'
    }
  }

  return {
    isAnomaly,
    score: Math.round(finalScore * 1000) / 1000,
    reason,
    anomalyType,
    severity: finalScore > 0.85 ? 'HIGH' : finalScore > 0.65 ? 'MEDIUM' : 'LOW',
    features: {
      amountZScore: Math.round(features.amountZScore * 100) / 100,
      velocity: features.velocity,
      percentile: Math.round(features.percentile * 100) / 100,
    },
  }
}

// Compute type distribution from a set of transactions
export function computeTypeDistribution(transactions) {
  const counts = {}
  transactions.forEach(tx => {
    counts[tx.type] = (counts[tx.type] || 0) + 1
  })

  const total = transactions.length || 1
  return Object.entries(counts).map(([type, count]) => ({
    type,
    count,
    percentage: Math.round((count / total) * 1000) / 10,
  })).sort((a, b) => b.count - a.count)
}

// Anomaly score distribution for histogram
export function computeScoreDistribution(transactions) {
  const bins = Array.from({ length: 10 }, (_, i) => ({
    range: `${(i * 0.1).toFixed(1)}-${((i + 1) * 0.1).toFixed(1)}`,
    min: i * 0.1,
    max: (i + 1) * 0.1,
    count: 0,
    anomalies: 0,
  }))

  transactions.forEach(tx => {
    const score = tx.anomalyScore || 0
    const binIdx = Math.min(Math.floor(score * 10), 9)
    bins[binIdx].count++
    if (tx.isAnomaly) bins[binIdx].anomalies++
  })

  return bins
}

// Radar chart data for transaction types
export function computeRadarData(transactions) {
  const types = ['Payment', 'EscrowCreate', 'EscrowFinish', 'OfferCreate', 'TrustSet', 'AccountSet']
  const total = transactions.length || 1

  return types.map(type => {
    const count = transactions.filter(tx => tx.type === type).length
    return {
      type: type.replace('Create', '+').replace('Finish', 'Fin'),
      count,
      percentage: Math.round((count / total) * 100),
      fullMark: Math.round(total * 0.6),
    }
  })
}
