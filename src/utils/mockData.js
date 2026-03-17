import { subDays, subHours, subMinutes, format } from 'date-fns'

// 10 unique agent wallet addresses
export const MOCK_AGENTS = [
  {
    id: 'agent_001',
    address: 'rAgentX1vK8T3mNpQs7LdFwYhR4cBzJ9eU',
    name: 'DataMind Alpha',
    specialty: 'Data Analysis',
    rating: 4.9,
    pricePerTask: 2.5,
    totalJobs: 1847,
    reputationScore: 98.2,
    description: 'Advanced data analytics and pattern recognition specialist',
    successRate: 99.1,
    avgCompletionTime: '45s',
    icon: '🧠',
  },
  {
    id: 'agent_002',
    address: 'rAgentX2mL5pQwNsR8KdGhT1cFzV6bY0j',
    name: 'ComputeNode Beta',
    specialty: 'Compute',
    rating: 4.7,
    pricePerTask: 5.0,
    totalJobs: 3214,
    reputationScore: 96.8,
    description: 'High-performance distributed computing tasks',
    successRate: 97.4,
    avgCompletionTime: '120s',
    icon: '⚡',
  },
  {
    id: 'agent_003',
    address: 'rAgentX3nW7tRvMqP2LaHdU9sYcK4gX1f',
    name: 'ModelForge Gamma',
    specialty: 'Model Training',
    rating: 4.8,
    pricePerTask: 15.0,
    totalJobs: 892,
    reputationScore: 97.5,
    description: 'ML model training and fine-tuning on distributed infrastructure',
    successRate: 98.6,
    avgCompletionTime: '300s',
    icon: '🔬',
  },
  {
    id: 'agent_004',
    address: 'rAgentX4bC9uSoJkE3NrWxT6mFpZhV5qD',
    name: 'APIBridge Delta',
    specialty: 'API Access',
    rating: 4.6,
    pricePerTask: 0.5,
    totalJobs: 12456,
    reputationScore: 95.3,
    description: 'Seamless API aggregation and data bridging across services',
    successRate: 96.2,
    avgCompletionTime: '8s',
    icon: '🔗',
  },
  {
    id: 'agent_005',
    address: 'rAgentX5dH2vTlKrM4OsBeP7nGqWyX8cZ',
    name: 'VaultKeeper Epsilon',
    specialty: 'Storage',
    rating: 4.9,
    pricePerTask: 1.0,
    totalJobs: 5678,
    reputationScore: 99.0,
    description: 'Decentralized storage with IPFS and Filecoin integration',
    successRate: 99.5,
    avgCompletionTime: '60s',
    icon: '💾',
  },
  {
    id: 'agent_006',
    address: 'rAgentX6eI3wUmLsN5PtCfQ8oHrXzY9aB',
    name: 'ValidatorPrime Zeta',
    specialty: 'Validation',
    rating: 4.8,
    pricePerTask: 3.0,
    totalJobs: 7234,
    reputationScore: 98.7,
    description: 'Zero-knowledge proof validation and smart contract auditing',
    successRate: 99.2,
    avgCompletionTime: '30s',
    icon: '✅',
  },
  {
    id: 'agent_007',
    address: 'rAgentX7fJ4xVnMtO6QuDgR9pIsYwZ0bC',
    name: 'OracleNet Eta',
    specialty: 'Data Analysis',
    rating: 4.5,
    pricePerTask: 4.0,
    totalJobs: 2341,
    reputationScore: 94.1,
    description: 'Real-time oracle data feeds with anomaly filtering',
    successRate: 95.8,
    avgCompletionTime: '25s',
    icon: '🔮',
  },
  {
    id: 'agent_008',
    address: 'rAgentX8gK5yWoNuP7RvEhS0qJtZxA1cD',
    name: 'NeuralSwarm Theta',
    specialty: 'Model Training',
    rating: 4.7,
    pricePerTask: 20.0,
    totalJobs: 456,
    reputationScore: 96.4,
    description: 'Federated learning and neural architecture search',
    successRate: 97.8,
    avgCompletionTime: '600s',
    icon: '🕸️',
  },
  {
    id: 'agent_009',
    address: 'rAgentX9hL6zXpOvQ8SwFiT1rKuAyB2dE',
    name: 'FluxBridge Iota',
    specialty: 'API Access',
    rating: 4.4,
    pricePerTask: 0.8,
    totalJobs: 9876,
    reputationScore: 93.7,
    description: 'Cross-chain bridge aggregator with MEV protection',
    successRate: 94.9,
    avgCompletionTime: '15s',
    icon: '🌊',
  },
  {
    id: 'agent_010',
    address: 'rAgentX0iM7aYqPwR9TxGjU2sLvBzC3eF',
    name: 'QuarkStore Kappa',
    specialty: 'Storage',
    rating: 4.6,
    pricePerTask: 1.5,
    totalJobs: 4123,
    reputationScore: 95.9,
    description: 'Quantum-resistant encrypted storage with redundancy',
    successRate: 97.1,
    avgCompletionTime: '45s',
    icon: '🗄️',
  },
]

const REQUESTER_ADDRESSES = [
  'rRequester1aBcDeFgHiJkLmNoPqRsTuVwXy',
  'rRequester2bCdEfGhIjKlMnOpQrStUvWxYz',
  'rRequester3cDeEfGhIjKlMnOpQrStUvWxYz',
  'rRequester4dEfFgHiJkLmNoPqRsTuVwXyZa',
  'rRequester5eFgGhIjKlMnOpQrStUvWxYzAb',
  'rRequester6fGhHiJkLmNoPqRsTuVwXyZaBc',
  'rRequester7gHiIjKlMnOpQrStUvWxYzAbCd',
  'rRequester8hIjJkLmNoPqRsTuVwXyZaBcDe',
]

const TX_TYPES = ['Payment', 'Payment', 'Payment', 'Payment', 'Payment',
  'EscrowCreate', 'EscrowCreate', 'EscrowFinish', 'EscrowCancel',
  'OfferCreate', 'OfferCreate', 'OfferDelete',
  'TrustSet', 'TrustSet',
  'AccountSet']

const ANOMALY_TYPES = ['volume_spike', 'rapid_fire', 'circular_transfer', 'escrow_manipulation']

let txCounter = 1000

export function generateMockTransaction(overrides = {}) {
  const now = new Date()
  const agentIdx = Math.floor(Math.random() * MOCK_AGENTS.length)
  const requesterIdx = Math.floor(Math.random() * REQUESTER_ADDRESSES.length)
  const typeIdx = Math.floor(Math.random() * TX_TYPES.length)
  const txType = TX_TYPES[typeIdx]

  // Determine anomaly (5% chance)
  const isAnomaly = Math.random() < 0.05
  const anomalyType = isAnomaly ? ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)] : null
  const anomalyScore = isAnomaly ? 0.7 + Math.random() * 0.3 : Math.random() * 0.4

  // Amount varies by anomaly
  let amount
  if (isAnomaly && anomalyType === 'volume_spike') {
    amount = 5000 + Math.random() * 5000
  } else if (isAnomaly && anomalyType === 'rapid_fire') {
    amount = 0.001 + Math.random() * 0.1
  } else {
    amount = Math.pow(10, Math.random() * 4 - 1) // 0.1 to 1000
    amount = Math.round(amount * 1000) / 1000
  }

  const hash = Array.from({ length: 64 }, () =>
    '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
  ).join('')

  txCounter++

  return {
    id: `tx_${txCounter}`,
    hash,
    type: txType,
    from: REQUESTER_ADDRESSES[requesterIdx],
    to: MOCK_AGENTS[agentIdx].address,
    amount,
    currency: 'RLUSD',
    timestamp: now.toISOString(),
    ledgerIndex: 90000000 + txCounter,
    fee: '0.000012',
    status: 'validated',
    isAnomaly,
    anomalyScore,
    anomalyType,
    agent: MOCK_AGENTS[agentIdx],
    agentId: MOCK_AGENTS[agentIdx].id,
    taskType: MOCK_AGENTS[agentIdx].specialty,
    ...overrides,
  }
}

// Generate 200 historical transactions over 7 days
function generateHistoricalTransactions() {
  const transactions = []
  const now = new Date()
  let anomalyCount = 0
  const targetAnomalies = 10 // ~5% of 200

  for (let i = 0; i < 200; i++) {
    // Spread over 7 days
    const daysAgo = Math.random() * 7
    const hoursAgo = daysAgo * 24
    const timestamp = subHours(now, hoursAgo)

    const agentIdx = Math.floor(Math.random() * MOCK_AGENTS.length)
    const requesterIdx = Math.floor(Math.random() * REQUESTER_ADDRESSES.length)
    const typeIdx = Math.floor(Math.random() * TX_TYPES.length)
    const txType = TX_TYPES[typeIdx]

    // Control anomaly ratio
    const remainingTx = 200 - i
    const remainingAnomalies = targetAnomalies - anomalyCount
    const anomalyProb = remainingAnomalies > 0 ? Math.min(0.15, remainingAnomalies / remainingTx) : 0
    const isAnomaly = Math.random() < anomalyProb
    if (isAnomaly) anomalyCount++

    const anomalyType = isAnomaly ? ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)] : null
    const anomalyScore = isAnomaly ? 0.7 + Math.random() * 0.3 : Math.random() * 0.5

    let amount
    if (isAnomaly && anomalyType === 'volume_spike') {
      amount = 5000 + Math.random() * 5000
    } else if (isAnomaly && anomalyType === 'rapid_fire') {
      amount = 0.001 + Math.random() * 0.1
    } else {
      const exp = Math.random() * 4 - 1
      amount = Math.round(Math.pow(10, exp) * 1000) / 1000
    }

    const hash = Array.from({ length: 64 }, () =>
      '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
    ).join('')

    transactions.push({
      id: `hist_${i}`,
      hash,
      type: txType,
      from: REQUESTER_ADDRESSES[requesterIdx],
      to: MOCK_AGENTS[agentIdx].address,
      amount,
      currency: 'RLUSD',
      timestamp: timestamp.toISOString(),
      ledgerIndex: 89000000 + i * 1000,
      fee: '0.000012',
      status: 'validated',
      isAnomaly,
      anomalyScore,
      anomalyType,
      agent: MOCK_AGENTS[agentIdx],
      agentId: MOCK_AGENTS[agentIdx].id,
      taskType: MOCK_AGENTS[agentIdx].specialty,
    })
  }

  // Sort by timestamp descending
  return transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

export const HISTORICAL_TRANSACTIONS = generateHistoricalTransactions()

export const ANOMALY_EVENTS = HISTORICAL_TRANSACTIONS
  .filter(tx => tx.isAnomaly)
  .map(tx => ({
    id: tx.id,
    time: tx.timestamp,
    type: tx.anomalyType,
    amount: tx.amount,
    currency: tx.currency,
    fromWallet: tx.from,
    toWallet: tx.to,
    score: tx.anomalyScore,
    severity: tx.anomalyScore > 0.85 ? 'HIGH' : 'MEDIUM',
    status: Math.random() > 0.5 ? 'resolved' : 'active',
    txType: tx.type,
    description: getAnomalyDescription(tx.anomalyType, tx.amount),
  }))

function getAnomalyDescription(type, amount) {
  switch (type) {
    case 'volume_spike':
      return `Unusual volume spike: ${amount.toFixed(2)} RLUSD exceeds 3σ threshold`
    case 'rapid_fire':
      return `High-frequency micro-transactions detected (${(Math.random() * 50 + 20).toFixed(0)} tx/min)`
    case 'circular_transfer':
      return `Funds cycled through ${Math.floor(Math.random() * 3 + 3)} intermediate wallets`
    case 'escrow_manipulation':
      return `Suspicious escrow pattern: early release attempt detected`
    default:
      return `Anomalous behavior detected with score ${(Math.random() * 0.3 + 0.7).toFixed(3)}`
  }
}

// Generate 7-day volume data for analytics
export function generateDailyVolumeData() {
  const data = []
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i)
    const dayLabel = format(date, 'MMM dd')
    const dayTransactions = HISTORICAL_TRANSACTIONS.filter(tx => {
      const txDate = new Date(tx.timestamp)
      return txDate >= subDays(date, 0.5) && txDate < subDays(date, -0.5)
    })

    const normalVolume = dayTransactions
      .filter(tx => !tx.isAnomaly)
      .reduce((sum, tx) => sum + tx.amount, 0)

    const anomalousVolume = dayTransactions
      .filter(tx => tx.isAnomaly)
      .reduce((sum, tx) => sum + tx.amount, 0)

    data.push({
      date: dayLabel,
      normalVolume: Math.round(normalVolume * 100) / 100,
      anomalousVolume: Math.round(anomalousVolume * 100) / 100,
      totalTx: dayTransactions.length,
      anomalyCount: dayTransactions.filter(tx => tx.isAnomaly).length,
    })
  }
  return data
}

// Generate 24x7 heatmap data
export function generateHeatmapData() {
  const data = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const date = subDays(new Date(), 6 - day)
      const cellDate = new Date(date)
      cellDate.setHours(hour)

      const txInCell = HISTORICAL_TRANSACTIONS.filter(tx => {
        const txDate = new Date(tx.timestamp)
        return txDate.getDay() === date.getDay() &&
          txDate.getHours() === hour
      })

      const volume = txInCell.reduce((sum, tx) => sum + tx.amount, 0)
      const hasAnomaly = txInCell.some(tx => tx.isAnomaly)

      data.push({
        day,
        hour,
        volume: Math.round(volume * 100) / 100,
        txCount: txInCell.length,
        hasAnomaly,
        dayLabel: format(date, 'EEE'),
      })
    }
  }
  return data
}

// Generate 48-hour bollinger band data
export function generateBollingerData() {
  const data = []
  const now = new Date()

  for (let h = 47; h >= 0; h--) {
    const hourDate = subHours(now, h)
    const label = format(hourDate, 'HH:mm')

    const txInHour = HISTORICAL_TRANSACTIONS.filter(tx => {
      const txDate = new Date(tx.timestamp)
      const diff = Math.abs(txDate - hourDate)
      return diff < 3600000 // within 1 hour
    })

    const volume = txInHour.reduce((sum, tx) => sum + tx.amount, 0)

    // Add noise for realistic look
    const baseVolume = volume + (Math.random() - 0.5) * 200 + 100
    const spike = Math.random() < 0.08 ? baseVolume * (1.5 + Math.random()) : 0

    data.push({
      time: label,
      volume: Math.round((baseVolume + spike) * 100) / 100,
      isSpike: spike > 0,
    })
  }

  // Calculate Bollinger Bands
  const window = 10
  return data.map((point, idx) => {
    if (idx < window) {
      return { ...point, upper: point.volume * 1.5, lower: point.volume * 0.5, sma: point.volume }
    }
    const slice = data.slice(idx - window, idx).map(d => d.volume)
    const sma = slice.reduce((a, b) => a + b, 0) / window
    const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / window
    const stdDev = Math.sqrt(variance)
    return {
      ...point,
      upper: Math.round((sma + 2 * stdDev) * 100) / 100,
      lower: Math.round(Math.max(0, sma - 2 * stdDev) * 100) / 100,
      sma: Math.round(sma * 100) / 100,
    }
  })
}

// Top agent pairs by volume
export function getTopAgentPairs() {
  const pairs = {}
  HISTORICAL_TRANSACTIONS.forEach(tx => {
    const key = `${tx.from.slice(0, 8)}...${tx.to.slice(0, 8)}`
    if (!pairs[key]) {
      pairs[key] = { from: tx.from, to: tx.to, volume: 0, txCount: 0, key }
    }
    pairs[key].volume += tx.amount
    pairs[key].txCount++
  })

  return Object.values(pairs)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 10)
    .map(p => ({
      ...p,
      volume: Math.round(p.volume * 100) / 100,
      fromShort: `${p.from.slice(0, 8)}...${p.from.slice(-4)}`,
      toShort: `${p.to.slice(0, 8)}...${p.to.slice(-4)}`,
    }))
}
