import { subDays, subHours, subMinutes, format } from 'date-fns'

// XRPL wallet addresses for simulation
const WALLET_ADDRESSES = [
  'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
  'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',
  'r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59',
  'rGWrZyax5eXbi5gs49MRZKmm3wEkNPGSQL',
  'rN7n3473SaZBCG4dFL83w7PB3vGNmEGQBT',
  'rDNvpqSzBmgFqzeEzFSCuCMDQYePCQTSXN',
  'r4GDFMLGJUKMjNEycY6m3S2HNtcTnygKsM',
  'rBKPS4oLSaV2KVVuHH8EpQqMGgGefGFQs7',
  'rLHzPsX6oXkzU2qL5BtsFMQbkzUxbMFGgW',
  'rHsMkBSMHkgSo5eKXGXPQCkJWrjFnZHxeQ',
  'rPbMHxs7vy3he6qLzWWnRBBNnuoFQBe9uC',
  'rKiCet8SdvWxPXnAgYarFUXd6PiVrokqe9',
  'rN2n9UkQnHsNDPBnqNFNpSUEkD9V7V6xgz',
  'rUpy3eEg8rqjqfUoLeBnZkscbKbFsKXC3v',
  'rBvKmPCjSFBWdbMXBmFRZqQRRTnmhRjbmV',
  'rQLbzfMnNfE7T5BHDW7cRjAxDNt1mHKVoS',
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
  const fromIdx = Math.floor(Math.random() * WALLET_ADDRESSES.length)
  let toIdx = Math.floor(Math.random() * WALLET_ADDRESSES.length)
  if (toIdx === fromIdx) toIdx = (toIdx + 1) % WALLET_ADDRESSES.length
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
    amount = Math.pow(10, Math.random() * 4 - 1)
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
    from: WALLET_ADDRESSES[fromIdx],
    to: WALLET_ADDRESSES[toIdx],
    amount,
    currency: 'RLUSD',
    timestamp: now.toISOString(),
    ledgerIndex: 90000000 + txCounter,
    fee: '0.000012',
    status: 'validated',
    isAnomaly,
    anomalyScore,
    anomalyType,
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

    const fromIdx = Math.floor(Math.random() * WALLET_ADDRESSES.length)
    const toIdx = (fromIdx + 1 + Math.floor(Math.random() * (WALLET_ADDRESSES.length - 1))) % WALLET_ADDRESSES.length
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
      from: WALLET_ADDRESSES[fromIdx],
      to: WALLET_ADDRESSES[toIdx],
      amount,
      currency: 'RLUSD',
      timestamp: timestamp.toISOString(),
      ledgerIndex: 89000000 + i * 1000,
      fee: '0.000012',
      status: 'validated',
      isAnomaly,
      anomalyScore,
      anomalyType,
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

// Top wallet pairs by volume
export function getTopWalletPairs() {
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
