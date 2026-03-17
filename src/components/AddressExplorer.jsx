import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Copy, Check, AlertTriangle, User, Activity } from 'lucide-react'
import { format } from 'date-fns'
import { useAddress, useTopAccounts } from '../hooks/useAPI.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function truncateAddr(addr, n = 12) {
  if (!addr) return '—'
  if (addr.length <= n + 6) return addr
  return `${addr.slice(0, n)}...${addr.slice(-4)}`
}

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }, [text])
  return (
    <button
      onClick={copy}
      className={`p-1 rounded text-slate-600 hover:text-slate-400 transition-colors ${className}`}
      title="Copy"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-400" />
        : <Copy className="w-3.5 h-3.5" />
      }
    </button>
  )
}

// Isolation score — big colored number
function IsolationScore({ score }) {
  const isHigh = score >= 0.7
  const isMed = score >= 0.3
  const color = isHigh ? 'text-red-400' : isMed ? 'text-amber-400' : 'text-emerald-400'
  const border = isHigh ? 'border-red-500/30 bg-red-500/10' : isMed ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/30 bg-emerald-500/10'
  return (
    <div className={`rounded-xl border p-4 text-center ${border}`}>
      <div className={`text-3xl font-bold font-mono ${color}`}>{score?.toFixed(3) ?? '—'}</div>
      <div className="text-xs text-slate-500 mt-1">Isolation Score</div>
      <div className={`text-[10px] mt-1 ${color}`}>
        {isHigh ? 'HIGH RISK' : isMed ? 'MEDIUM' : 'LOW RISK'}
      </div>
    </div>
  )
}

function MetricPill({ label, value, color = 'text-slate-300' }) {
  return (
    <div className="rounded-lg border border-[#2a3045] bg-[#0a0e1a] px-4 py-2 text-center">
      <div className={`text-base font-bold font-mono ${color}`}>{value ?? '—'}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

// Transaction type badge
const TX_TYPE_COLORS = {
  Payment: 'bg-blue-500/20 text-blue-300',
  OfferCreate: 'bg-purple-500/20 text-purple-300',
  OfferDelete: 'bg-purple-500/10 text-purple-400',
  EscrowCreate: 'bg-cyan-500/20 text-cyan-300',
  EscrowFinish: 'bg-cyan-500/10 text-cyan-400',
  TrustSet: 'bg-yellow-500/20 text-yellow-300',
  AccountSet: 'bg-slate-500/20 text-slate-300',
}

function TxTypeBadge({ type }) {
  const cls = TX_TYPE_COLORS[type] || 'bg-slate-500/20 text-slate-300'
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      {type || 'TX'}
    </span>
  )
}

// ── Address profile ───────────────────────────────────────────────────────────

function AddressProfile({ data }) {
  const address = data.address || ''
  const totalTx = data.total_transactions ?? data.tx_count ?? 0
  const anomalyAsAttacker = data.anomaly_count_as_attacker ?? data.anomaly_as_attacker ?? 0
  const anomalyAsVictim = data.anomaly_count_as_victim ?? data.anomaly_as_victim ?? 0
  const ngfr = data.ngfr_score ?? data.ngfr ?? null
  const rtr = data.rtr_score ?? data.rtr ?? null
  const isolationScore = data.isolation_score ?? data.score ?? 0
  const offerCancelRate = data.offer_cancel_rate ?? null
  const transactions = data.transactions || data.recent_transactions || []

  return (
    <div className="space-y-5">
      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-[#2a3045] bg-[#1a1d27] p-5"
      >
        <div className="flex items-start gap-4 flex-wrap">
          {/* Address block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <User className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Address</span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-mono text-sm text-slate-100 break-all">{address}</span>
              <CopyButton text={address} className="shrink-0" />
            </div>
          </div>

          {/* Isolation score */}
          <IsolationScore score={isolationScore} />
        </div>

        {/* Metrics bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <MetricPill label="Total Transactions" value={totalTx.toLocaleString()} color="text-blue-400" />
          <MetricPill label="As Attacker" value={anomalyAsAttacker} color="text-red-400" />
          <MetricPill label="As Victim" value={anomalyAsVictim} color="text-amber-400" />
          <MetricPill
            label="Offer Cancel Rate"
            value={offerCancelRate != null ? `${(offerCancelRate * 100).toFixed(1)}%` : '—'}
            color="text-slate-300"
          />
        </div>

        {/* NGFR / RTR */}
        {(ngfr != null || rtr != null) && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            {ngfr != null && (
              <MetricPill label="NGFR Score" value={typeof ngfr === 'number' ? ngfr.toFixed(4) : ngfr} color="text-purple-400" />
            )}
            {rtr != null && (
              <MetricPill label="RTR Score" value={typeof rtr === 'number' ? rtr.toFixed(4) : rtr} color="text-cyan-400" />
            )}
          </div>
        )}
      </motion.div>

      {/* Transaction timeline */}
      {transactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-[#2a3045] bg-[#1a1d27] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a3045]">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">Transaction Timeline</span>
            <span className="text-xs text-slate-500 ml-1">({Math.min(transactions.length, 50)} shown)</span>
          </div>

          {/* Column headers */}
          <div className="grid gap-2 px-4 py-2 bg-[#0a0e1a] border-b border-[#2a3045] text-[10px] text-slate-600 uppercase tracking-wider font-semibold"
            style={{ gridTemplateColumns: 'auto auto 1fr auto auto' }}>
            <div>Ledger</div>
            <div>Type</div>
            <div>From → To</div>
            <div className="text-right">Amount</div>
            <div></div>
          </div>

          <div className="divide-y divide-[#2a3045]/50">
            {transactions.slice(0, 50).map((tx, i) => {
              const isAnomaly = tx.is_anomaly || tx.isAnomaly || false
              const from = tx.from || tx.account || tx.Account || ''
              const to = tx.to || tx.destination || tx.Destination || ''
              const amount = tx.amount || tx.Amount
              const txType = tx.type || tx.tx_type || tx.TransactionType || ''
              const ledger = tx.ledger_index || tx.LedgerIndex
              const ts = tx.timestamp || tx.date

              return (
                <div
                  key={tx.id || tx.hash || i}
                  className={`grid gap-2 items-center px-4 py-2.5 text-xs hover:bg-[#242938] transition-colors ${
                    isAnomaly ? 'bg-red-500/5' : ''
                  }`}
                  style={{ gridTemplateColumns: 'auto auto 1fr auto auto' }}
                >
                  {/* Ledger */}
                  <div className="font-mono text-slate-500 whitespace-nowrap">
                    {ledger?.toLocaleString() ?? '—'}
                  </div>

                  {/* Type */}
                  <TxTypeBadge type={txType} />

                  {/* From → To */}
                  <div className="flex items-center gap-1 font-mono text-slate-400 min-w-0">
                    <span className="truncate text-blue-400/80">{truncateAddr(from, 8)}</span>
                    <span className="text-slate-600 shrink-0">→</span>
                    <span className="truncate text-purple-400/80">{truncateAddr(to, 8)}</span>
                  </div>

                  {/* Amount */}
                  <div className="text-right font-mono text-emerald-400 whitespace-nowrap">
                    {amount != null
                      ? (parseFloat(amount) >= 1e6
                          ? `${(parseFloat(amount) / 1e6).toFixed(2)}M`
                          : parseFloat(amount) >= 1e3
                          ? `${(parseFloat(amount) / 1e3).toFixed(2)}K`
                          : parseFloat(amount).toFixed(3))
                      : '—'}
                  </div>

                  {/* Anomaly flag */}
                  <div>
                    {isAnomaly && (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" title="Anomaly" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ── Top accounts table ────────────────────────────────────────────────────────

function TopAccountsTable({ data, onSelect }) {
  const accounts = data?.accounts || data
  if (!Array.isArray(accounts) || accounts.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[#2a3045] bg-[#1a1d27] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a3045]">
        <Activity className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-semibold text-slate-200">Top Accounts</span>
        <span className="text-xs text-slate-500 ml-1">Click a row to explore</span>
      </div>

      <div className="grid gap-0 text-[10px] text-slate-600 uppercase tracking-wider font-semibold px-4 py-2 bg-[#0a0e1a] border-b border-[#2a3045]"
        style={{ gridTemplateColumns: '1fr auto auto auto' }}>
        <div>Address</div>
        <div className="text-right pr-4">Tx Count</div>
        <div className="text-right pr-4">Anomalies</div>
        <div>Isolation</div>
      </div>

      <div className="divide-y divide-[#2a3045]/50">
        {accounts.slice(0, 20).map((acc, i) => {
          const addr = acc.address || acc.account || ''
          const score = acc.isolation_score ?? acc.score ?? 0
          const isHigh = score >= 0.7
          const isMed = score >= 0.3
          const scoreColor = isHigh ? 'text-red-400' : isMed ? 'text-amber-400' : 'text-emerald-400'

          return (
            <div
              key={i}
              className="grid gap-0 items-center px-4 py-2.5 text-xs cursor-pointer hover:bg-[#242938] transition-colors"
              style={{ gridTemplateColumns: '1fr auto auto auto' }}
              onClick={() => onSelect(addr)}
            >
              <div className="font-mono text-blue-400 truncate pr-2">
                {truncateAddr(addr, 14)}
              </div>
              <div className="text-slate-400 text-right pr-4">{acc.tx_count?.toLocaleString() ?? '—'}</div>
              <div className="text-red-400 text-right pr-4">{acc.anomaly_count ?? '—'}</div>
              <div className="flex items-center gap-2">
                <div className="w-14 h-1.5 bg-[#0a0e1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isHigh ? 'bg-red-500' : isMed ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.round(score * 100)}%` }}
                  />
                </div>
                <span className={`font-mono ${scoreColor}`}>{score.toFixed(2)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AddressExplorer() {
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState('')

  const { data, loading, error } = useAddress(searched)
  const { data: topAccountsData, loading: topLoading } = useTopAccounts()

  const handleSearch = useCallback((e) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) setSearched(trimmed)
  }, [query])

  const handleSelectAccount = useCallback((addr) => {
    setQuery(addr)
    setSearched(addr)
  }, [])

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="rounded-xl border border-[#2a3045] bg-[#1a1d27] p-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Enter XRPL address (e.g. rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh)"
              className="w-full bg-[#0a0e1a] border border-[#2a3045] rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </form>
      </div>

      {/* No search yet: show top accounts */}
      {!searched && (
        <>
          {topLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500 text-sm">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Loading accounts...
            </div>
          )}
          {!topLoading && topAccountsData && (
            <TopAccountsTable data={topAccountsData} onSelect={handleSelectAccount} />
          )}
          {!topLoading && !topAccountsData && (
            <div className="rounded-xl border border-[#2a3045] bg-[#1a1d27] p-10 text-center text-slate-500 text-sm">
              Enter an XRPL address above to explore its profile and transaction history.
            </div>
          )}
        </>
      )}

      {/* Searched: show loading / error / result */}
      {searched && (
        <>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Looking up address...
            </div>
          )}

          {!loading && (error || !data) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-[#2a3045] bg-[#1a1d27] p-10 text-center space-y-2"
            >
              <AlertTriangle className="w-8 h-8 text-amber-500/50 mx-auto" />
              <p className="text-slate-400 text-sm">Address not found or backend offline</p>
              {searched && (
                <p className="text-slate-600 text-xs font-mono break-all">{searched}</p>
              )}
              <button
                onClick={() => setSearched('')}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Clear search
              </button>
            </motion.div>
          )}

          {!loading && data && <AddressProfile data={data} />}
        </>
      )}
    </div>
  )
}
