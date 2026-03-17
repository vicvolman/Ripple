import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import {
  AlertTriangle, Search, ChevronDown, ChevronUp,
  Play, CheckCircle, Clock, Shield, Cpu, Brain
} from 'lucide-react'
import { format } from 'date-fns'
import { ANOMALY_EVENTS, HISTORICAL_TRANSACTIONS } from '../utils/mockData.js'
import { computeScoreDistribution, MODEL_METADATA } from '../utils/mlModels.js'

// Gauge-style progress bar
function MetricGauge({ label, value, color }) {
  const pct = Math.round(value * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-bold font-mono" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 bg-[#0a0e1a] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  )
}

// Anomaly row (expandable)
function AnomalyRow({ event, index }) {
  const [expanded, setExpanded] = useState(false)

  const severityConfig = {
    HIGH: { cls: 'text-red-300 bg-red-500/20 border-red-500/30', dot: 'bg-red-400' },
    MEDIUM: { cls: 'text-yellow-300 bg-yellow-500/20 border-yellow-500/30', dot: 'bg-yellow-400' },
    LOW: { cls: 'text-green-300 bg-green-500/20 border-green-500/30', dot: 'bg-green-400' },
  }
  const cfg = severityConfig[event.severity] || severityConfig.MEDIUM

  const typeLabels = {
    volume_spike: 'Volume Spike',
    rapid_fire: 'Rapid Fire',
    circular_transfer: 'Circular Transfer',
    escrow_manipulation: 'Escrow Manipulation',
  }

  const featureData = [
    { name: 'Z-Score', value: Math.round((event.score * 8) * 100) / 100 },
    { name: 'Velocity', value: Math.round(event.score * 15) },
    { name: 'Percentile', value: Math.round(event.score * 99) },
    { name: 'Freq', value: Math.round(event.score * 10) / 10 },
    { name: 'Pattern', value: Math.round(event.score * 0.9 * 100) / 100 },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {/* Main row */}
      <div
        className={`grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto] gap-3 items-center px-4 py-3 cursor-pointer hover:bg-[#242938] transition-colors border-b border-[#2a3045]/50 ${
          expanded ? 'bg-[#242938]' : ''
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Time */}
        <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
          {format(new Date(event.time), 'MM/dd HH:mm')}
        </div>

        {/* Type */}
        <div className="text-xs text-slate-300">
          {typeLabels[event.type] || event.type}
        </div>

        {/* Amount */}
        <div className="text-xs font-mono text-emerald-400">
          {parseFloat(event.amount).toFixed(2)} RLUSD
        </div>

        {/* Score */}
        <div className="text-center">
          <div
            className="text-xs font-bold font-mono"
            style={{ color: event.score > 0.85 ? '#f87171' : '#fbbf24' }}
          >
            {event.score.toFixed(3)}
          </div>
        </div>

        {/* Severity */}
        <div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cfg.cls}`}>
            {event.severity}
          </span>
        </div>

        {/* Status */}
        <div>
          <span className={`text-[10px] px-2 py-0.5 rounded ${
            event.status === 'resolved'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-yellow-500/10 text-yellow-400'
          }`}>
            {event.status}
          </span>
        </div>

        {/* Expand */}
        <div className="text-slate-600">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded features */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-[#0f1420] border-b border-[#2a3045]"
          >
            <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Wallets */}
              <div>
                <div className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">Wallets</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-600 w-8">From:</span>
                    <span className="font-mono text-blue-400">{event.fromWallet?.slice(0, 16)}...</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-600 w-8">To:</span>
                    <span className="font-mono text-purple-400">{event.toWallet?.slice(0, 16)}...</span>
                  </div>
                </div>
              </div>

              {/* Feature breakdown */}
              <div>
                <div className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">Feature Scores</div>
                <div className="flex gap-2">
                  {featureData.map(f => (
                    <div key={f.name} className="flex-1 text-center">
                      <div className="text-[10px] text-slate-600 mb-1">{f.name}</div>
                      <div className="text-xs font-mono font-bold text-slate-300">{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <div className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Detection Reason</div>
                <p className="text-xs text-slate-400 leading-relaxed">{event.description}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Scan progress animation
function ScanProgress({ isScanning, progress }) {
  return (
    <div className="relative overflow-hidden bg-[#0a0e1a] rounded-lg p-3 border border-[#2a3045]">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-slate-400">Scanning {HISTORICAL_TRANSACTIONS.length} transactions...</span>
        <span className="font-mono text-blue-400">{Math.round(progress)}%</span>
      </div>
      <div className="h-1.5 bg-[#2a3045] rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
      {/* Scan line */}
      <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
        <motion.div
          className="absolute top-0 left-0 right-0 h-full"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.1) 50%, transparent 100%)',
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    </div>
  )
}

export default function Anomalies({ transactions, anomalyQueue }) {
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanResults, setScanResults] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTx, setSearchTx] = useState('')

  const scoreDistribution = useMemo(
    () => computeScoreDistribution(HISTORICAL_TRANSACTIONS),
    []
  )

  const filteredEvents = useMemo(() => {
    return ANOMALY_EVENTS.filter(e => {
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter
      const matchesSearch = !searchTx ||
        e.type?.includes(searchTx.toLowerCase()) ||
        e.fromWallet?.toLowerCase().includes(searchTx.toLowerCase()) ||
        e.toWallet?.toLowerCase().includes(searchTx.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [statusFilter, searchTx])

  const runScan = () => {
    if (isScanning) return
    setIsScanning(true)
    setScanProgress(0)
    setScanResults(null)

    const startTime = Date.now()
    const duration = 3000

    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min((elapsed / duration) * 100, 100)
      setScanProgress(progress)

      if (progress < 100) {
        requestAnimationFrame(tick)
      } else {
        setIsScanning(false)
        setScanResults({
          scanned: HISTORICAL_TRANSACTIONS.length,
          anomalies: ANOMALY_EVENTS.length,
          newAnomalies: Math.floor(Math.random() * 3),
          timestamp: new Date().toISOString(),
        })
      }
    }
    requestAnimationFrame(tick)
  }

  const maxBarCount = Math.max(...scoreDistribution.map(b => b.count), 1)

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Model info card */}
        <div className="lg:col-span-2 bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                <Brain className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">{MODEL_METADATA.name}</h3>
                <p className="text-xs text-slate-500">v{MODEL_METADATA.version} • {MODEL_METADATA.features} features</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Last trained</div>
              <div className="text-xs font-mono text-slate-400">
                {format(new Date(MODEL_METADATA.lastTrained), 'MMM dd, yyyy')}
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Accuracy', value: MODEL_METADATA.accuracy, color: '#10b981' },
              { label: 'Precision', value: MODEL_METADATA.precision, color: '#3b82f6' },
              { label: 'Recall', value: MODEL_METADATA.recall, color: '#8b5cf6' },
            ].map(m => (
              <div key={m.label} className="text-center bg-[#0a0e1a] rounded-lg p-3">
                <div className="text-xl font-bold font-mono" style={{ color: m.color }}>
                  {(m.value * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Gauges */}
          <div className="space-y-2">
            <MetricGauge label="Precision" value={MODEL_METADATA.precision} color="#3b82f6" />
            <MetricGauge label="Recall" value={MODEL_METADATA.recall} color="#8b5cf6" />
            <MetricGauge label="F1 Score" value={MODEL_METADATA.f1Score} color="#10b981" />
          </div>
        </div>

        {/* Scan panel */}
        <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">Run New Scan</span>
          </div>

          <div className="space-y-2 flex-1">
            <div className="text-xs text-slate-500">Scan configuration</div>
            {[
              { label: 'Transactions', value: HISTORICAL_TRANSACTIONS.length },
              { label: 'Algorithm', value: 'Isolation Forest' },
              { label: 'Threshold', value: `${MODEL_METADATA.anomalyThreshold}` },
              { label: 'Features', value: MODEL_METADATA.features },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-xs">
                <span className="text-slate-600">{item.label}</span>
                <span className="font-mono text-slate-400">{item.value}</span>
              </div>
            ))}
          </div>

          {isScanning && (
            <ScanProgress isScanning={isScanning} progress={scanProgress} />
          )}

          {scanResults && !isScanning && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">Scan Complete</span>
              </div>
              <div className="space-y-1 text-slate-400">
                <div>Scanned: {scanResults.scanned} txns</div>
                <div>Anomalies: {scanResults.anomalies} total</div>
                {scanResults.newAnomalies > 0 && (
                  <div className="text-yellow-400">+{scanResults.newAnomalies} new detected</div>
                )}
              </div>
            </motion.div>
          )}

          <button
            onClick={runScan}
            disabled={isScanning}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              isScanning
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white transform hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isScanning ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Cpu className="w-4 h-4" />
                </motion.div>
                Scanning...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run New Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Score distribution histogram */}
      <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold text-slate-200">Anomaly Score Distribution</span>
          <span className="ml-auto text-xs text-slate-500">
            Threshold: {MODEL_METADATA.anomalyThreshold} | {ANOMALY_EVENTS.length} anomalies / {HISTORICAL_TRANSACTIONS.length} txns
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={scoreDistribution} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2035" vertical={false} />
            <XAxis
              dataKey="range"
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-lg p-2.5 text-xs">
                    <p className="text-slate-400">Score: {label}</p>
                    <p className="font-mono text-slate-200">{d?.count} transactions</p>
                    {d?.anomalies > 0 && (
                      <p className="font-mono text-red-400">{d.anomalies} anomalies</p>
                    )}
                  </div>
                )
              }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {scoreDistribution.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.min >= MODEL_METADATA.anomalyThreshold
                    ? `rgba(239, 68, 68, ${0.4 + entry.count / maxBarCount * 0.6})`
                    : `rgba(59, 130, 246, ${0.3 + entry.count / maxBarCount * 0.5})`
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-3 mt-1 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500/50" /> Normal range
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/60" /> Above threshold ({MODEL_METADATA.anomalyThreshold})
          </div>
        </div>
      </div>

      {/* Anomaly events table */}
      <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl overflow-hidden">
        {/* Table toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a3045]">
          <Shield className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-slate-200">Anomaly Events</span>
          <span className="text-xs text-slate-500 ml-1">({filteredEvents.length})</span>

          <div className="ml-auto flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTx}
                onChange={e => setSearchTx(e.target.value)}
                className="bg-[#0a0e1a] border border-[#2a3045] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:border-blue-500/40 w-40"
              />
            </div>

            {/* Status filter */}
            <div className="flex gap-1">
              {['all', 'active', 'resolved'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${
                    statusFilter === s
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto] gap-3 px-4 py-2 bg-[#0a0e1a] border-b border-[#2a3045]">
          {['Time', 'Type', 'Amount', 'Score', 'Severity', 'Status', ''].map(col => (
            <div key={col} className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">
              {col}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div>
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event, i) => (
              <AnomalyRow key={event.id || i} event={event} index={i} />
            ))
          ) : (
            <div className="text-center py-12 text-slate-600">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No anomaly events match your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
