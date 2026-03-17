import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  AlertTriangle, ChevronDown, ChevronUp,
  Shield, Brain, Copy, Check, Database
} from 'lucide-react'
import { format } from 'date-fns'
import { useAnomalies, useStats, useAnomalyDistribution } from '../hooks/useAPI.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateAddr(addr, n = 10) {
  if (!addr) return '—'
  if (addr.length <= n + 6) return addr
  return `${addr.slice(0, n)}...${addr.slice(-4)}`
}

function CopyButton({ text }) {
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
    <button onClick={copy} className="ml-1 p-0.5 rounded text-slate-600 hover:text-slate-400 transition-colors shrink-0" title="Copy">
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

const TYPE_BADGE_CFG = {
  sandwich:             'bg-red-500/20 text-red-300 border-red-500/30',
  wash_trade:           'bg-purple-500/20 text-purple-300 border-purple-500/30',
  pathfinder_inflation: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
}
const TYPE_LABEL = {
  sandwich:             'Sandwich',
  wash_trade:           'Wash Trade',
  pathfinder_inflation: 'Pathfinder',
}

function TypeBadge({ type }) {
  const cls = TYPE_BADGE_CFG[type] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  const label = TYPE_LABEL[type] || (type ?? 'Unknown').replace(/_/g, ' ')
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

// ── Anomaly row ───────────────────────────────────────────────────────────────

function AnomalyRow({ event, index }) {
  const [expanded, setExpanded] = useState(false)

  const confidence = event.confidence_score ?? event.confidence ?? 0
  const confPct = Math.round(confidence * 100)
  const confColor = confidence >= 0.8 ? '#f87171' : confidence >= 0.5 ? '#fbbf24' : '#a3e635'

  let detail = null
  if (event.detail_json) {
    try { detail = typeof event.detail_json === 'string' ? JSON.parse(event.detail_json) : event.detail_json }
    catch { detail = { description: event.detail_json } }
  }

  let txHashes = []
  if (event.tx_hashes) {
    try { txHashes = JSON.parse(event.tx_hashes) } catch { txHashes = [] }
  }

  const time = event.timestamp || event.detected_at
  const attacker = event.attacker_address || ''
  const victim = event.victim_address || ''
  const profit = event.profit_xrp

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }}>
      <div
        className={`grid gap-2 items-center px-4 py-3 cursor-pointer hover:bg-[#242938] transition-colors border-b border-[#2a3045]/50 text-xs ${expanded ? 'bg-[#242938]' : ''}`}
        style={{ gridTemplateColumns: 'auto auto 1fr 1fr 1fr auto auto auto' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="text-slate-500 font-mono whitespace-nowrap">
          {time ? format(new Date(time), 'MM/dd HH:mm') : '—'}
        </div>
        <TypeBadge type={event.anomaly_type} />
        <div className="text-slate-400 truncate">{event.asset_pair || '—'}</div>
        <div className="flex items-center font-mono text-red-300 min-w-0">
          <span className="truncate">{truncateAddr(attacker)}</span>
          {attacker && <CopyButton text={attacker} />}
        </div>
        <div className="flex items-center font-mono text-slate-400 min-w-0">
          <span className="truncate">{truncateAddr(victim)}</span>
          {victim && <CopyButton text={victim} />}
        </div>
        <div className="font-mono text-emerald-400 text-right whitespace-nowrap">
          {profit != null ? `${parseFloat(profit).toFixed(4)} XRP` : '—'}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-14 h-1.5 bg-[#0a0e1a] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${confPct}%`, background: confColor }} />
          </div>
          <span className="font-mono w-7 text-right" style={{ color: confColor }}>{confPct}%</span>
        </div>
        <div className="text-slate-600">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden bg-[#0f1420] border-b border-[#2a3045]">
            <div className="px-4 py-4 space-y-3 text-xs">
              {detail?.description && (
                <div>
                  <div className="text-slate-500 mb-1 font-semibold uppercase tracking-wider">Description</div>
                  <p className="text-slate-400 leading-relaxed">{detail.description}</p>
                </div>
              )}
              {txHashes.length > 0 && (
                <div>
                  <div className="text-slate-500 mb-1 font-semibold uppercase tracking-wider">Transaction Hashes</div>
                  <div className="space-y-1">
                    {txHashes.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 font-mono text-blue-400">
                        <span className="truncate">{h.slice(0, 24)}...{h.slice(-8)}</span>
                        <CopyButton text={h} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {event.ledger_index && (
                <div>
                  <span className="text-slate-500 font-semibold uppercase tracking-wider">Ledger: </span>
                  <span className="font-mono text-slate-300">{event.ledger_index}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const ANOMALY_TYPE_OPTIONS = [
  { key: 'sandwich', label: 'Sandwich' },
  { key: 'wash_trade', label: 'Wash Trade' },
  { key: 'pathfinder_inflation', label: 'Pathfinder' },
]
const TIME_RANGES = ['1h', '6h', '24h', 'all']

function FilterBar({ filters, onChange }) {
  const toggleType = (t) => {
    const next = (filters.types || []).includes(t)
      ? filters.types.filter(x => x !== t)
      : [...(filters.types || []), t]
    onChange({ ...filters, types: next })
  }
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-[#0f1420] border-b border-[#2a3045]">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Type:</span>
        {ANOMALY_TYPE_OPTIONS.map(({ key, label }) => {
          const active = (filters.types || []).includes(key)
          return (
            <button key={key} onClick={() => toggleType(key)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-all ${
                active ? (TYPE_BADGE_CFG[key] || '') : 'bg-transparent text-slate-600 border-[#2a3045] hover:border-slate-500'
              }`}>
              {label}
            </button>
          )
        })}
        {(filters.types || []).length > 0 && (
          <button onClick={() => onChange({ ...filters, types: [] })} className="text-[10px] text-slate-500 hover:text-slate-300 px-1">clear</button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap">
          Min Conf: <span className="text-slate-300 font-mono">{filters.minConfidence ?? 0}%</span>
        </span>
        <input type="range" min={0} max={100} step={5} value={filters.minConfidence ?? 0}
          onChange={e => onChange({ ...filters, minConfidence: Number(e.target.value) })}
          className="w-24 accent-blue-500" />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Range:</span>
        {TIME_RANGES.map(r => (
          <button key={r} onClick={() => onChange({ ...filters, timeRange: r })}
            className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase transition-colors ${
              (filters.timeRange ?? 'all') === r ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}>
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Score distribution from full backend dataset ──────────────────────────────

function ScoreDistributionChart({ distData, loading }) {
  const data = useMemo(() => {
    // Use exact scores from the DB rather than fixed 0.1 buckets
    const byScore = distData?.by_score ?? []
    if (byScore.length === 0) return []
    return byScore.map(b => ({
      label: b.score.toFixed(2),
      count: b.total,
      score: b.score,
    }))
  }, [distData])

  if (loading) return <div className="h-40 flex items-center justify-center text-slate-600 text-sm animate-pulse">Loading...</div>
  if (!data.length) return null

  const max = Math.max(...data.map(d => d.count), 1)
  const threshold = 0.7

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barSize={40}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2035" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
          tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
        <Tooltip content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null
          return (
            <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-lg p-2 text-xs">
              <p className="text-slate-400">Confidence: {label}</p>
              <p className="font-mono text-slate-200">{payload[0]?.value?.toLocaleString()} anomalies</p>
            </div>
          )
        }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i}
              fill={entry.score >= threshold
                ? `rgba(239,68,68,${0.4 + entry.count / max * 0.6})`
                : `rgba(59,130,246,${0.3 + entry.count / max * 0.5})`
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Anomalies() {
  const [apiFilters, setApiFilters] = useState({ types: [], minConfidence: 0, timeRange: 'all' })

  const { data: backendData, loading: backendLoading } = useAnomalies(apiFilters)
  const { data: statsData } = useStats()
  const { data: distData, loading: distLoading } = useAnomalyDistribution()

  const anomalies = backendData?.items ?? []
  const total = backendData?.total ?? 0
  const statsTypes = statsData?.anomaly_count_by_type ?? {}
  const totalTx = statsData?.total_transactions ?? 0

  return (
    <div className="space-y-6">

      {/* Stats row — real numbers from backend */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Database, label: 'Total Transactions', value: totalTx.toLocaleString(), color: 'bg-cyan-500/15 text-cyan-400' },
          { icon: AlertTriangle, label: 'Total Anomalies', value: total.toLocaleString(), color: 'bg-red-500/15 text-red-400' },
          { icon: Shield, label: 'Sandwich Attacks', value: (statsTypes.sandwich ?? 0).toLocaleString(), color: 'bg-orange-500/15 text-orange-400' },
          { icon: Brain, label: 'Wash Trade Clusters', value: (statsTypes.wash_trade ?? 0).toLocaleString(), color: 'bg-purple-500/15 text-purple-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-100 font-mono">{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Confidence score distribution — built from real anomaly confidence_score values */}
      <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold text-slate-200">Confidence Score Distribution</span>
          <span className="ml-auto text-xs text-slate-500">
            {distData?.total?.toLocaleString() ?? '—'} total anomalies · threshold 0.7
          </span>
        </div>
        <ScoreDistributionChart distData={distData} loading={distLoading} />
        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500/50 inline-block" /> Normal (&lt;0.7)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/60 inline-block" /> High confidence (≥0.7)</span>
        </div>
      </div>

      {/* Anomaly events table */}
      <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a3045]">
          <Shield className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-slate-200">Anomaly Events</span>
          <span className="text-xs text-slate-500">
            {backendLoading ? 'Loading...' : `${anomalies.length} shown of ${total.toLocaleString()} total`}
          </span>
        </div>

        <FilterBar filters={apiFilters} onChange={setApiFilters} />

        {/* Column headers */}
        <div className="grid gap-2 px-4 py-2 bg-[#0a0e1a] border-b border-[#2a3045] text-[10px] text-slate-600 uppercase tracking-wider font-semibold"
          style={{ gridTemplateColumns: 'auto auto 1fr 1fr 1fr auto auto auto' }}>
          <div>Time</div><div>Type</div><div>Asset Pair</div>
          <div>Attacker</div><div>Victim</div>
          <div className="text-right">Profit XRP</div><div>Confidence</div><div />
        </div>

        <div>
          {backendLoading && anomalies.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Brain className="w-4 h-4" />
              </motion.div>
              Loading anomalies from backend...
            </div>
          )}
          {anomalies.map((event, i) => (
            <AnomalyRow key={event.id ?? i} event={event} index={i} />
          ))}
          {!backendLoading && anomalies.length === 0 && (
            <div className="text-center py-12 text-slate-600">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No anomalies match your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
