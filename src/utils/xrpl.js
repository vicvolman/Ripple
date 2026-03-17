import { generateMockTransaction } from './mockData.js'

const XRPL_WSS = import.meta.env?.VITE_XRPL_WSS || 'wss://s1.ripple.com'
const MOCK_MODE_ENV = import.meta.env?.VITE_MOCK_MODE === 'true'

let mockIntervalId = null
let mockLedgerIndex = 90000000
let activeCallbacks = []
let wsInstance = null
let reconnectTimer = null

// Format raw XRPL transaction into normalized form
export function formatTransaction(rawTx) {
  const tx = rawTx?.transaction || rawTx?.tx || rawTx || {}
  const meta = rawTx?.meta || {}

  let amount = 0
  let currency = 'XRP'

  if (tx.Amount) {
    if (typeof tx.Amount === 'string') {
      amount = parseFloat(tx.Amount) / 1_000_000 // drops to XRP
      currency = 'XRP'
    } else if (typeof tx.Amount === 'object') {
      amount = parseFloat(tx.Amount.value) || 0
      currency = tx.Amount.currency || 'RLUSD'
    }
  } else if (tx.SendMax) {
    if (typeof tx.SendMax === 'object') {
      amount = parseFloat(tx.SendMax.value) || 0
      currency = tx.SendMax.currency || 'RLUSD'
    }
  }

  const hash = Array.from({ length: 64 }, () =>
    '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
  ).join('')

  return {
    id: tx.hash || hash,
    hash: tx.hash || hash,
    type: tx.TransactionType || 'Payment',
    from: tx.Account || 'rUnknown',
    to: tx.Destination || tx.Account || 'rUnknown',
    amount: Math.round(amount * 1000) / 1000,
    currency,
    timestamp: tx.date
      ? new Date((tx.date + 946684800) * 1000).toISOString()
      : new Date().toISOString(),
    ledgerIndex: rawTx?.ledger_index || mockLedgerIndex,
    fee: tx.Fee ? (parseInt(tx.Fee) / 1_000_000).toFixed(6) : '0.000012',
    status: meta?.TransactionResult === 'tesSUCCESS' ? 'validated' : 'pending',
    isAnomaly: false,
    anomalyScore: 0,
    anomalyType: null,
    raw: tx,
  }
}

// Mock mode: generate transactions at interval
function startMockMode(callback) {
  console.log('[AgentX] Starting mock transaction stream...')
  mockLedgerIndex = 90000000 + Math.floor(Math.random() * 100000)

  if (mockIntervalId) clearInterval(mockIntervalId)

  // Immediately send a few
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      mockLedgerIndex++
      const tx = generateMockTransaction({ ledgerIndex: mockLedgerIndex })
      callback(tx, mockLedgerIndex)
    }, i * 300)
  }

  mockIntervalId = setInterval(() => {
    mockLedgerIndex++
    // Occasionally send multiple (burst)
    const count = Math.random() < 0.15 ? Math.floor(Math.random() * 3) + 2 : 1
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const tx = generateMockTransaction({ ledgerIndex: mockLedgerIndex })
        callback(tx, mockLedgerIndex)
      }, i * 100)
    }
  }, 2000)

  return mockLedgerIndex
}

function stopMockMode() {
  if (mockIntervalId) {
    clearInterval(mockIntervalId)
    mockIntervalId = null
  }
}

// Connect to XRPL WebSocket with mock fallback
export async function connectToXRPL(onTransaction, onStatusChange) {
  if (MOCK_MODE_ENV) {
    onStatusChange?.({ connected: false, isMockMode: true, ledgerIndex: mockLedgerIndex })
    startMockMode((tx, ledger) => {
      onTransaction?.(tx, ledger)
    })
    return { isMockMode: true, disconnect: stopMockMode }
  }

  return new Promise((resolve) => {
    let connectionTimeout = setTimeout(() => {
      console.log('[AgentX] XRPL connection timeout, falling back to mock mode')
      onStatusChange?.({ connected: false, isMockMode: true, ledgerIndex: mockLedgerIndex })
      startMockMode((tx, ledger) => {
        onTransaction?.(tx, ledger)
      })
      resolve({ isMockMode: true, disconnect: stopMockMode })
    }, 5000)

    try {
      const ws = new WebSocket(XRPL_WSS)
      wsInstance = ws

      ws.onopen = () => {
        clearTimeout(connectionTimeout)
        console.log('[AgentX] Connected to XRPL:', XRPL_WSS)

        // Subscribe to ledger stream
        ws.send(JSON.stringify({
          command: 'subscribe',
          streams: ['transactions', 'ledger'],
        }))

        onStatusChange?.({ connected: true, isMockMode: false, ledgerIndex: mockLedgerIndex })
        resolve({
          isMockMode: false,
          disconnect: () => {
            ws.close()
            stopMockMode()
          },
        })
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'ledgerClosed') {
            mockLedgerIndex = data.ledger_index || mockLedgerIndex
            onStatusChange?.({ connected: true, isMockMode: false, ledgerIndex: mockLedgerIndex })
          }

          if (data.type === 'transaction' && data.transaction) {
            const formatted = formatTransaction(data)
            onTransaction?.(formatted, mockLedgerIndex)
          }
        } catch (e) {
          // ignore parse errors
        }
      }

      ws.onerror = (err) => {
        clearTimeout(connectionTimeout)
        console.log('[AgentX] WebSocket error, switching to mock mode')
        onStatusChange?.({ connected: false, isMockMode: true, ledgerIndex: mockLedgerIndex })
        startMockMode((tx, ledger) => {
          onTransaction?.(tx, ledger)
        })
        resolve({ isMockMode: true, disconnect: stopMockMode })
      }

      ws.onclose = () => {
        onStatusChange?.({ connected: false, isMockMode: true, ledgerIndex: mockLedgerIndex })
        // Auto-reconnect with mock fallback
        if (!MOCK_MODE_ENV) {
          console.log('[AgentX] WebSocket closed, starting mock mode')
          startMockMode((tx, ledger) => {
            onTransaction?.(tx, ledger)
          })
        }
      }
    } catch (err) {
      clearTimeout(connectionTimeout)
      console.log('[AgentX] Could not create WebSocket, using mock mode:', err.message)
      onStatusChange?.({ connected: false, isMockMode: true, ledgerIndex: mockLedgerIndex })
      startMockMode((tx, ledger) => {
        onTransaction?.(tx, ledger)
      })
      resolve({ isMockMode: true, disconnect: stopMockMode })
    }
  })
}

// Subscribe to ledger updates
export function subscribeToLedger(callback) {
  activeCallbacks.push(callback)
  return () => {
    activeCallbacks = activeCallbacks.filter(cb => cb !== callback)
  }
}

// Submit agent payment (simulation)
export async function submitAgentPayment(fromAddress, toAddress, amount, currency = 'RLUSD') {
  // Simulate transaction submission states
  return new Promise((resolve) => {
    // Phase 1: Signing
    setTimeout(() => {
      const txHash = Array.from({ length: 64 }, () =>
        '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
      ).join('')

      // Phase 2: Broadcasting
      setTimeout(() => {
        mockLedgerIndex++

        // Phase 3: Confirmed
        setTimeout(() => {
          resolve({
            success: true,
            hash: txHash,
            ledgerIndex: mockLedgerIndex,
            fee: '0.000012',
            status: 'validated',
            timestamp: new Date().toISOString(),
            amount,
            currency,
            from: fromAddress,
            to: toAddress,
            protocolFee: Math.round(amount * 0.001 * 1000) / 1000,
          })
        }, 1500)
      }, 1000)
    }, 500)
  })
}

// Get current ledger index
export function getCurrentLedgerIndex() {
  return mockLedgerIndex
}

// Truncate address for display
export function truncateAddress(address, start = 8, end = 4) {
  if (!address || address.length < start + end + 3) return address
  return `${address.slice(0, start)}...${address.slice(-end)}`
}

// Format RLUSD amount with proper decimals
export function formatAmount(amount, currency = 'RLUSD') {
  if (amount === undefined || amount === null) return '0.000'
  const num = parseFloat(amount)
  if (isNaN(num)) return '0.000'
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
  if (num >= 1) return num.toFixed(3)
  return num.toFixed(6)
}
