import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ArrowRight, Zap, Pause, Play } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const TYPE_CONFIG = {
  Payment: { label: 'PAY', cls: 'badge-payment' },
  EscrowCreate: { label: 'ESC+', cls: 'badge-escrow' },
  EscrowFinish: { label: 'ESC✓', cls: 'badge-escrow' },
  EscrowCancel: { label: 'ESC✗', cls: 'badge-escrow' },
  OfferCreate: { label: 'OFFER', cls: 'badge-offer' },
  OfferDelete: { label: 'O-DEL', cls: 'badge-offer' },
  TrustSet: { label: 'TRUST', cls: 'badge-trust' },
  AccountSet: { label: 'ACCT', cls: 'badge-other' },
}

function truncate(str, n = 8) {
  if (!str) return '???'
  return `${str.slice(0, n)}...${str.slice(-4)}`
}

function formatAmt(amount) {
  const n = parseFloat(amount)
  if (isNaN(n)) return '0.000'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  if (n >= 1) return n.toFixed(3)
  return n.toFixed(5)
}

function TxRow({ tx }) {
  const typeConfig = TYPE_CONFIG[tx.type] || { label: 'TX', cls: 'badge-other' }
  const timeAgo = tx.timestamp
    ? formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })
    : 'just now'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
      animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all duration-200 ${
        tx.isAnomaly
          ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
          : 'border-transparent hover:bg-[#242938]'
      }`}
    >
      <span className={`badge ${typeConfig.cls} shrink-0 min-w-[44px] justify-center`}>
        {typeConfig.label}
      </span>

      <div className="flex items-center gap-1 flex-1 min-w-0 font-mono text-xs text-slate-400">
        <span className="truncate text-slate-300">{truncate(tx.from)}</span>
        <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
        <span className="truncate">{truncate(tx.to)}</span>
      </div>

      <div className="text-right shrink-0">
        <div className="text-xs font-semibold font-mono text-emerald-400">
          {formatAmt(tx.amount)}
        </div>
        <div className="text-[10px] text-slate-600">{tx.currency || 'RLUSD'}</div>
      </div>

      {tx.isAnomaly && (
        <div className="shrink-0" title={`Anomaly: ${tx.anomalyType} (score: ${(tx.anomalyScore || 0).toFixed(3)})`}>
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
        </div>
      )}

      <div className="text-[10px] text-slate-600 shrink-0 hidden sm:block w-16 text-right">
        {timeAgo}
      </div>
    </motion.div>
  )
}

export default function LiveFeed({ transactions, maxItems = 20, compact = false }) {
  const [displayTx, setDisplayTx] = useState(transactions.slice(0, maxItems))
  const [paused, setPaused] = useState(false)
  const [pending, setPending] = useState(0)
  const latestRef = useRef(transactions)

  useEffect(() => {
    latestRef.current = transactions
  }, [transactions])

  // Update display every 3 seconds unless paused
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setDisplayTx(latestRef.current.slice(0, maxItems))
      setPending(0)
    }, 3000)
    return () => clearInterval(id)
  }, [paused, maxItems])

  // Count pending while paused
  useEffect(() => {
    if (!paused) return
    const newCount = Math.max(0, transactions.length - displayTx.length)
    setPending(newCount)
  }, [transactions, paused])

  const handleResume = () => {
    setDisplayTx(latestRef.current.slice(0, maxItems))
    setPending(0)
    setPaused(false)
  }

  return (
    <div className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {!compact && (
        <div className="flex items-center justify-between px-3 pb-2 border-b border-[#2a3045]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-slate-200">Live Feed</span>
            {pending > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                +{pending} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{displayTx.filter(t => t.isAnomaly).length} anomalies</span>
            <span className="text-xs font-mono text-slate-400">{displayTx.length} txns</span>
            <button
              onClick={() => paused ? handleResume() : setPaused(true)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                paused
                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  : 'bg-slate-700/40 text-slate-400 hover:bg-slate-700/60'
              }`}
            >
              {paused
                ? <><Play className="w-3 h-3" /> Resume</>
                : <><Pause className="w-3 h-3" /> Pause</>
              }
            </button>
          </div>
        </div>
      )}

      {!compact && (
        <div className="flex items-center gap-2 px-3 py-1">
          <span className="text-[10px] text-slate-600 uppercase tracking-wider w-[44px]">Type</span>
          <span className="text-[10px] text-slate-600 uppercase tracking-wider flex-1">From → To</span>
          <span className="text-[10px] text-slate-600 uppercase tracking-wider text-right">Amount</span>
          <div className="w-3.5" />
          <span className="text-[10px] text-slate-600 uppercase tracking-wider w-16 text-right hidden sm:block">Time</span>
        </div>
      )}

      <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[400px]">
        <AnimatePresence initial={false} mode="popLayout">
          {displayTx.map((tx, i) => (
            <TxRow key={tx.id || tx.hash || i} tx={tx} />
          ))}
        </AnimatePresence>
        {displayTx.length === 0 && (
          <div className="text-center text-slate-600 text-sm py-8">
            Waiting for transactions...
          </div>
        )}
      </div>
    </div>
  )
}
