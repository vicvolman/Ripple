import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ArrowRight, Zap } from 'lucide-react'
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
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
  if (n >= 1) return n.toFixed(3)
  return n.toFixed(5)
}

function TxRow({ tx, isNew }) {
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
      {/* Type badge */}
      <span className={`badge ${typeConfig.cls} shrink-0 min-w-[44px] justify-center`}>
        {typeConfig.label}
      </span>

      {/* Addresses */}
      <div className="flex items-center gap-1 flex-1 min-w-0 font-mono text-xs text-slate-400">
        <span className="truncate text-slate-300">{truncate(tx.from)}</span>
        <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
        <span className="truncate">{truncate(tx.to)}</span>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <div className="text-xs font-semibold font-mono text-emerald-400">
          {formatAmt(tx.amount)}
        </div>
        <div className="text-[10px] text-slate-600">{tx.currency || 'RLUSD'}</div>
      </div>

      {/* Anomaly flag */}
      {tx.isAnomaly && (
        <div className="shrink-0" title={`Anomaly: ${tx.anomalyType} (score: ${(tx.anomalyScore || 0).toFixed(3)})`}>
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
        </div>
      )}

      {/* Time */}
      <div className="text-[10px] text-slate-600 shrink-0 hidden sm:block w-16 text-right">
        {timeAgo}
      </div>
    </motion.div>
  )
}

export default function LiveFeed({ transactions, maxItems = 20, compact = false }) {
  const [displayTx, setDisplayTx] = useState([])
  const prevLengthRef = useRef(0)

  useEffect(() => {
    setDisplayTx(transactions.slice(0, maxItems))
  }, [transactions, maxItems])

  const newCount = Math.max(0, transactions.length - prevLengthRef.current)
  useEffect(() => {
    prevLengthRef.current = transactions.length
  }, [transactions])

  return (
    <div className={`flex flex-col ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between px-3 pb-2 border-b border-[#2a3045]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-slate-200">Live Feed</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{displayTx.filter(t => t.isAnomaly).length} anomalies</span>
            <span className="text-xs font-mono text-slate-400">{displayTx.length} txns</span>
          </div>
        </div>
      )}

      {/* Column headers */}
      {!compact && (
        <div className="flex items-center gap-2 px-3 py-1">
          <span className="text-[10px] text-slate-600 uppercase tracking-wider w-[44px]">Type</span>
          <span className="text-[10px] text-slate-600 uppercase tracking-wider flex-1">From → To</span>
          <span className="text-[10px] text-slate-600 uppercase tracking-wider text-right">Amount</span>
          <div className="w-3.5" />
          <span className="text-[10px] text-slate-600 uppercase tracking-wider w-16 text-right hidden sm:block">Time</span>
        </div>
      )}

      {/* Transactions */}
      <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[400px]">
        <AnimatePresence initial={false} mode="popLayout">
          {displayTx.map((tx, i) => (
            <TxRow
              key={tx.id || tx.hash || i}
              tx={tx}
              isNew={i < newCount}
            />
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
