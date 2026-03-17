import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Activity, AlertTriangle, Wallet, DollarSign,
  X, Shield, ArrowRightLeft, Database, Layers
} from 'lucide-react'
import LiveFeed from './LiveFeed.jsx'
import { useStats, useTopAccounts, useFeeStats } from '../hooks/useAPI.js'

// Animated counter hook
function useAnimatedCounter(value, duration = 800) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef(null)

  useEffect(() => {
    const start = prevRef.current
    const end = value
    const diff = end - start
    if (diff === 0) return

    const startTime = performance.now()
    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + diff * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        prevRef.current = end
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return display
}

// Stat card
function StatCard({ icon: Icon, label, value, subValue, color, suffix = '', trend }) {
  const displayValue = useAnimatedCounter(typeof value === 'number' ? value : 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5 flex items-center gap-4 hover:border-slate-600 transition-all duration-200"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} shrink-0`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-slate-100 font-mono tabular-nums">
          {typeof value === 'number' ? displayValue.toLocaleString() : value}
          {suffix && <span className="text-base ml-1 text-slate-400">{suffix}</span>}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
        {subValue && (
          <div className="text-xs text-slate-600 mt-0.5">{subValue}</div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`ml-auto text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </div>
      )}
    </motion.div>
  )
}

// Anomaly alert card
function AnomalyAlert({ anomaly, onDismiss }) {
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDismissing(true)
      setTimeout(() => onDismiss?.(anomaly.id || anomaly.hash), 400)
    }, 10000)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    setDismissing(true)
    setTimeout(() => onDismiss?.(anomaly.id || anomaly.hash), 400)
  }

  const severity = anomaly.severity || (anomaly.anomalyScore > 0.85 ? 'HIGH' : 'MEDIUM')

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: dismissing ? 0 : 1, x: dismissing ? 100 : 0 }}
      transition={{ duration: 0.35 }}
      className={`p-3 rounded-lg border flex items-start gap-3 ${
        severity === 'HIGH'
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-yellow-500/10 border-yellow-500/30'
      }`}
    >
      <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${severity === 'HIGH' ? 'text-red-400' : 'text-yellow-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
            severity === 'HIGH'
              ? 'bg-red-500/20 text-red-300'
              : 'bg-yellow-500/20 text-yellow-300'
          }`}>
            {severity}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {(anomaly.anomalyScore || anomaly.score || anomaly.confidence || 0).toFixed(3)}
          </span>
          {(anomaly.anomalyType || anomaly.type) && (
            <span className="text-[10px] text-slate-500 uppercase">
              {(anomaly.anomalyType || anomaly.type || '').replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-300 leading-relaxed truncate">
          {anomaly.reason || anomaly.description || `Anomalous ${anomaly.type || 'activity'} detected`}
        </p>
        {anomaly.amount && (
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            Amount: {parseFloat(anomaly.amount).toFixed(3)} {anomaly.currency || 'RLUSD'}
          </div>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

// XRPL Payment Flow diagram
function PaymentFlowDiagram() {
  const [step, setStep] = useState(0)
  const { data: feeData } = useFeeStats()

  useEffect(() => {
    const interval = setInterval(() => setStep(s => (s + 1) % 4), 900)
    return () => clearInterval(interval)
  }, [])

  const nodes = [
    { label: 'Sender Wallet', sub: 'XRPL Account', icon: '👤', color: '#3b82f6' },
    { label: 'XRPL Ledger', sub: 'Consensus', icon: '🔗', color: '#8b5cf6' },
    { label: 'Validation', sub: 'tesSUCCESS', icon: '✅', color: '#06b6d4' },
    { label: 'Receiver Wallet', sub: 'XRPL Account', icon: '🏦', color: '#10b981' },
  ]

  const steps = [
    'Sender signs & submits transaction',
    'XRPL consensus validates ledger',
    'Transaction result confirmed',
    'Amount credited to receiver',
  ]

  const { data: statsData } = useStats()

  // Real fee from backend fee-stats endpoint
  const avgFeeLabel = feeData?.avg_fee_xrp != null
    ? `${feeData.avg_fee_xrp.toFixed(6)} XRP`
    : '—'

  const closingTime = '~3-5s'

  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-slate-200">XRPL Payment Flow</span>
        <span className="ml-auto text-[10px] text-slate-600 font-mono">{closingTime} settlement</span>
      </div>

      <div className="flex items-center justify-between relative mb-4">
        {/* Lines */}
        <div className="absolute inset-x-8 top-6 flex" style={{ zIndex: 0 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 relative h-0.5 bg-[#2a3045]">
              <div
                className="absolute top-0 h-full transition-all duration-300"
                style={{
                  background: `linear-gradient(90deg, transparent, ${nodes[i].color}, transparent)`,
                  width: '40%',
                  left: step === i ? '60%' : '-40%',
                  opacity: step === i ? 1 : 0,
                  transition: 'left 0.7s ease, opacity 0.3s',
                }}
              />
            </div>
          ))}
        </div>

        {nodes.map((node, i) => (
          <div key={node.label} className="flex flex-col items-center gap-1.5 relative z-10">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-lg border-2 transition-all duration-400"
              style={{
                borderColor: step === i ? node.color : '#2a3045',
                background: step === i ? `${node.color}20` : '#0a0e1a',
                boxShadow: step === i ? `0 0 18px ${node.color}50` : 'none',
              }}
            >
              {node.icon}
            </div>
            <span className="text-[10px] text-slate-400 font-medium text-center leading-tight">{node.label}</span>
            <span className="text-[9px] text-slate-600 font-mono">{node.sub}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1 mt-2">
        {steps.map((s, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs py-1 px-2 rounded transition-all duration-300 ${step === i ? 'bg-blue-500/10 text-slate-200' : 'text-slate-600'}`}>
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-300 ${step === i ? 'bg-blue-400' : 'bg-slate-700'}`} />
            {s}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          { label: 'Avg Fee', value: avgFeeLabel },
          { label: 'Settlement', value: closingTime },
          { label: 'Total Txns', value: statsData?.total_transactions != null ? statsData.total_transactions.toLocaleString() : '—' },
        ].map(stat => (
          <div key={stat.label} className="bg-[#0a0e1a] border border-[#2a3045] rounded-lg p-2 text-center">
            <div className="text-xs font-bold text-slate-300">{stat.value}</div>
            <div className="text-[9px] text-slate-600 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatVolume(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  return n.toFixed(2)
}

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#f97316', '#ec4899']

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-lg p-3 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{d.name}</p>
      <p className="text-sm font-bold text-white">{d.value} txns</p>
      <p className="text-xs text-slate-400">{d.payload.percentage}%</p>
    </div>
  )
}

// Confidence color helper
function confidenceColor(confidence) {
  if (confidence >= 0.8) return 'bg-red-500'
  if (confidence >= 0.5) return 'bg-amber-500'
  return 'bg-yellow-400'
}

// Type badge for backend anomaly types
function AnomalyTypeBadge({ type }) {
  const cfg = {
    'Sandwich Attack': 'bg-red-500/20 text-red-300 border-red-500/30',
    'Pathfinder Inflation': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'Wash Trade': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  }
  const cls = cfg[type] || 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}`}>
      {type || 'Unknown'}
    </span>
  )
}

// Recent Anomalies Panel (from backend WS)
function RecentAnomaliesPanel({ recentAnomalies }) {
  const items = (recentAnomalies || []).slice(0, 5)

  if (items.length === 0) return null

  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <span className="text-sm font-semibold text-slate-200">Recent Anomaly Alerts</span>
        <span className="ml-auto text-[10px] text-slate-500 font-mono">Live · backend</span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => {
          const confidence = item.confidence ?? item.score ?? 0
          const attacker = item.attacker || item.address || ''
          return (
            <div key={item.id || i} className="flex items-center gap-3 py-1.5 border-b border-[#2a3045]/50 last:border-0">
              <AnomalyTypeBadge type={item.anomaly_type || item.type} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  {attacker ? `${attacker.slice(0, 10)}...${attacker.slice(-4)}` : '—'}
                </div>
              </div>
              {/* Confidence bar */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1.5 bg-[#0a0e1a] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${confidenceColor(confidence)}`}
                    style={{ width: `${Math.round(confidence * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-500 w-7 text-right">
                  {Math.round(confidence * 100)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Last Ledger card (from backend WS)
function LastLedgerCard({ ledgerUpdates }) {
  const latest = ledgerUpdates && ledgerUpdates.length > 0 ? ledgerUpdates[0] : null
  if (!latest) return null

  const ledgerIndex = latest.ledger_index ?? latest.ledgerIndex
  const txCount = latest.tx_count ?? latest.txn_count ?? latest.transactions ?? '—'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1a1f2e] border border-blue-500/20 rounded-xl p-5 flex items-center gap-4 hover:border-blue-500/40 transition-all duration-200"
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-400 shrink-0">
        <Layers className="w-6 h-6" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-slate-100 font-mono tabular-nums">
          #{ledgerIndex?.toLocaleString() ?? '—'}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">Last Ledger</div>
        <div className="text-xs text-slate-600 mt-0.5">{txCount} txns</div>
      </div>
      <div className="ml-auto">
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
      </div>
    </motion.div>
  )
}

// Backend stats KPI row — uses real /api/stats data
function BackendStatsRow({ statsData }) {
  if (!statsData) return null

  const totalTx = statsData.total_transactions ?? 0
  const totalLedgers = statsData.total_ledgers ?? 0
  // API returns keys like "sandwich", "wash_trade"
  const anomalyTypes = statsData.anomaly_count_by_type ?? {}
  const totalAnomalies = Object.values(anomalyTypes).reduce((s, v) => s + (v ?? 0), 0)
  const sandwichCount = anomalyTypes.sandwich ?? 0
  const washCount = anomalyTypes.wash_trade ?? 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Database}
        label="Total Transactions"
        value={totalTx}
        subValue={`${totalLedgers.toLocaleString()} ledgers`}
        color="bg-cyan-500/15 text-cyan-400"
      />
      <StatCard
        icon={AlertTriangle}
        label="Total Anomalies"
        value={totalAnomalies}
        subValue="All detected types"
        color="bg-red-500/15 text-red-400"
      />
      <StatCard
        icon={Shield}
        label="Sandwich Attacks"
        value={sandwichCount}
        subValue="Front-running detected"
        color="bg-orange-500/15 text-orange-400"
      />
      <StatCard
        icon={Activity}
        label="Wash Trade Clusters"
        value={washCount}
        subValue="NGFR < 0.05 flagged"
        color="bg-purple-500/15 text-purple-400"
      />
    </div>
  )
}

export default function Dashboard({ transactions, anomalyQueue, modelStats, onDismissAnomaly, ledgerUpdates, recentAnomalies }) {
  const [localAnomalies, setLocalAnomalies] = useState([])
  const { data: statsData } = useStats()
  const { data: topAccountsData } = useTopAccounts()

  // Merge incoming anomaly queue with local display
  useEffect(() => {
    setLocalAnomalies(prev => {
      const newIds = new Set(prev.map(a => a.id || a.hash))
      const incoming = (anomalyQueue || []).filter(a => !newIds.has(a.id || a.hash))
      return [...incoming, ...prev].slice(0, 8)
    })
  }, [anomalyQueue])

  const handleDismiss = useCallback((id) => {
    setLocalAnomalies(prev => prev.filter(a => (a.id || a.hash) !== id))
    onDismissAnomaly?.(id)
  }, [onDismissAnomaly])

  // Pie chart: anomaly breakdown from real stats, or top accounts by isolation score
  const anomalyTypes = statsData?.anomaly_count_by_type ?? {}
  const pieData = Object.entries(anomalyTypes)
    .filter(([, v]) => v > 0)
    .map(([k, v], i) => ({
      name: k.replace(/_/g, ' '),
      value: v,
      percentage: statsData?.total_transactions
        ? ((v / statsData.total_transactions) * 100).toFixed(2)
        : '—',
    }))

  // Top addresses for isolation score display
  const topAddresses = topAccountsData?.accounts ?? []

  const hasLedgerUpdates = ledgerUpdates && ledgerUpdates.length > 0
  const hasRecentAnomalies = recentAnomalies && recentAnomalies.length > 0

  return (
    <div className="space-y-6">
      {/* Real KPI row from /api/stats */}
      {statsData
        ? <BackendStatsRow statsData={statsData} />
        : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5 h-24 animate-pulse" />
            ))}
          </div>
        )
      }

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Transaction Feed */}
        <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
          <LiveFeed transactions={transactions} maxItems={20} />
        </div>

        {/* Anomaly type breakdown pie — real data from /api/stats */}
        <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-slate-200">Anomaly Breakdown</span>
            <span className="ml-auto text-[10px] text-blue-400 font-mono">Backend · real data</span>
          </div>

          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend formatter={(value) => <span className="text-xs text-slate-400 capitalize">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center text-slate-600 text-sm animate-pulse">
              Loading anomaly data...
            </div>
          )}

          {/* Isolation Forest summary */}
          {topAddresses.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#2a3045]">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Top flagged addresses (Isolation Forest)</div>
              <div className="space-y-1">
                {topAddresses.slice(0, 3).map((acc, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-slate-400 truncate flex-1">
                      {acc.address?.slice(0, 12)}...{acc.address?.slice(-4)}
                    </span>
                    <div className="w-16 h-1.5 bg-[#0a0e1a] rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full rounded-full ${(acc.isolation_score ?? 0) >= 0.7 ? 'bg-red-500' : 'bg-amber-400'}`}
                        style={{ width: `${Math.round((acc.isolation_score ?? 0) * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-slate-500 w-8 text-right shrink-0">
                      {((acc.isolation_score ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Anomaly Alerts */}
        <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-slate-200">Active Anomaly Alerts</span>
            </div>
            {localAnomalies.length > 0 && (
              <button
                onClick={() => setLocalAnomalies([])}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            <AnimatePresence>
              {localAnomalies.length > 0 ? (
                localAnomalies.map(anomaly => (
                  <AnomalyAlert
                    key={anomaly.id || anomaly.hash}
                    anomaly={anomaly}
                    onDismiss={handleDismiss}
                  />
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8"
                >
                  <Shield className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">No active anomalies</p>
                  <p className="text-xs text-slate-700 mt-1">ML monitoring active</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* XRPL Payment Flow */}
        <PaymentFlowDiagram />
      </div>

      {/* Recent Anomalies from backend WS */}
      {hasRecentAnomalies && (
        <RecentAnomaliesPanel recentAnomalies={recentAnomalies} />
      )}
    </div>
  )
}
