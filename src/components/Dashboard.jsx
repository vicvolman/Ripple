import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Activity, AlertTriangle, Wallet, DollarSign,
  X, Shield, ArrowRightLeft
} from 'lucide-react'
import LiveFeed from './LiveFeed.jsx'

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
      const eased = 1 - Math.pow(1 - progress, 3) // cubic ease out
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
            {(anomaly.anomalyScore || anomaly.score || 0).toFixed(3)}
          </span>
          {anomaly.anomalyType && (
            <span className="text-[10px] text-slate-500 uppercase">
              {anomaly.anomalyType.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-300 leading-relaxed truncate">
          {anomaly.reason || anomaly.description || `Anomalous ${anomaly.type} detected`}
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

  useEffect(() => {
    const interval = setInterval(() => setStep(s => (s + 1) % 4), 900)
    return () => clearInterval(interval)
  }, [])

  const nodes = [
    { label: 'Sender Wallet', sub: 'rXXXX...YYYY', icon: '👤', color: '#3b82f6' },
    { label: 'XRPL Ledger', sub: 'Consensus', icon: '🔗', color: '#8b5cf6' },
    { label: 'Validation', sub: 'tesSUCCESS', icon: '✅', color: '#06b6d4' },
    { label: 'Receiver Wallet', sub: 'rAAAA...BBBB', icon: '🏦', color: '#10b981' },
  ]

  const steps = [
    'Sender signs & submits transaction',
    'XRPL consensus validates ledger',
    'Transaction result confirmed',
    'RLUSD credited to receiver',
  ]

  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-slate-200">XRPL Payment Flow</span>
        <span className="ml-auto text-[10px] text-slate-600 font-mono">~3-5s settlement</span>
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
          { label: 'Avg Fee', value: '0.00001 XRP' },
          { label: 'Finality', value: '~4 seconds' },
          { label: 'Throughput', value: '1,500 TPS' },
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

export default function Dashboard({ transactions, anomalyQueue, modelStats, onDismissAnomaly }) {
  const [localAnomalies, setLocalAnomalies] = useState([])

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

  // Compute stats
  const totalTx = transactions.length
  const totalVolume = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0)
  const uniqueWallets = new Set([...transactions.map(tx => tx.from), ...transactions.map(tx => tx.to)]).size
  const anomalyCount = (anomalyQueue || []).length + transactions.filter(t => t.isAnomaly).length

  // Pie chart data
  const typeDistribution = modelStats?.typeDistribution || []
  const pieData = typeDistribution.slice(0, 7).map(d => ({
    name: d.type,
    value: d.count,
    percentage: d.percentage,
  }))

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total Transactions"
          value={totalTx}
          subValue="Last 100 live"
          color="bg-blue-500/15 text-blue-400"
          trend={8}
        />
        <StatCard
          icon={DollarSign}
          label="RLUSD Volume"
          value={formatVolume(totalVolume)}
          subValue="Rolling window"
          color="bg-emerald-500/15 text-emerald-400"
          trend={12}
        />
        <StatCard
          icon={Wallet}
          label="Unique Wallets"
          value={uniqueWallets}
          subValue="Senders & receivers"
          color="bg-purple-500/15 text-purple-400"
          trend={3}
        />
        <StatCard
          icon={AlertTriangle}
          label="Anomalies Detected"
          value={(anomalyQueue || []).length}
          subValue={`${(modelStats?.anomalyRate || 0).toFixed(1)}% rate`}
          color="bg-red-500/15 text-red-400"
          trend={-2}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Transaction Feed */}
        <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
          <LiveFeed transactions={transactions} maxItems={20} />
        </div>

        {/* ML Classification Donut */}
        <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-slate-200">ML Classification</span>
            <span className="ml-auto text-xs text-slate-500 font-mono">
              {modelStats?.name || 'Isolation Forest + RF'}
            </span>
          </div>

          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-slate-400">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-600 text-sm">
              Classifying transactions...
            </div>
          )}

          {/* Model accuracy badge */}
          <div className="mt-2 flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {((modelStats?.accuracy || 0.963) * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-600">Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400 font-mono">
                {modelStats?.features || 8}
              </div>
              <div className="text-[10px] text-slate-600">Features</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400 font-mono">
                {modelStats?.totalClassified || 0}
              </div>
              <div className="text-[10px] text-slate-600">Classified</div>
            </div>
          </div>
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
    </div>
  )
}
