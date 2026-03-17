import { useState } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, ReferenceLine, Area, AreaChart, ComposedChart
} from 'recharts'
import { motion } from 'framer-motion'
import { TrendingUp, BarChart2, Activity, Users, Clock, Grid } from 'lucide-react'
import { useVolume, useTopAccounts, useTxTypes, useWalletPairs, useVolumeSeries } from '../hooks/useAPI.js'

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#f97316', '#ec4899']

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-lg p-3 shadow-xl text-xs">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold font-mono" style={{ color: p.color }}>
            {formatter ? formatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ icon: Icon, title, iconColor = 'text-blue-400', badge }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <span className="text-sm font-semibold text-slate-200">{title}</span>
      {badge && <span className="ml-auto text-[10px] text-blue-400 font-mono">{badge}</span>}
    </div>
  )
}

function Skeleton({ h = 220 }) {
  return <div className="animate-pulse bg-[#2a3045]/40 rounded-lg" style={{ height: h }} />
}

// ── Volume: Raw vs Adjusted ───────────────────────────────────────────────────

function VolumeChart({ data, loading }) {
  if (loading) return <Skeleton />
  const buckets = data?.buckets ?? []
  if (!buckets.length) return <p className="text-slate-600 text-sm text-center py-12">No volume data</p>

  const chartData = buckets.map(b => ({
    time: (b.timestamp ?? '').slice(-5),
    raw: +(b.raw_volume ?? 0).toFixed(2),
    adjusted: +(b.adjusted_volume ?? 0).toFixed(2),
    anomalies: b.anomaly_count ?? 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2035" vertical={false} />
        <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
          tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(1)}K` : v} />
        <Tooltip content={<CustomTooltip formatter={v => `${(+v).toLocaleString()} drops`} />} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
        <Area type="monotone" dataKey="raw" name="Raw Volume" stroke="#3b82f6" fill="#3b82f615" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="adjusted" name="Adjusted Volume" stroke="#10b981" fill="#10b98115" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function VolumeSummaryCards({ data }) {
  if (!data?.summary) return null
  const s = data.summary
  const cards = [
    { label: 'Raw Volume (drops)', value: (s.raw_total ?? 0).toExponential(3), color: 'text-blue-400' },
    { label: 'Adjusted Volume', value: (s.adjusted_total ?? 0).toExponential(3), color: 'text-emerald-400' },
    { label: 'Wash Trade Ratio', value: `${((s.wash_trade_ratio ?? 0) * 100).toFixed(2)}%`, color: 'text-red-400' },
    { label: 'Dust Tx Ratio', value: `${((s.dust_ratio ?? 0) * 100).toFixed(1)}%`, color: 'text-amber-400' },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map(c => (
        <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4 text-center">
          <div className={`text-lg font-bold font-mono ${c.color}`}>{c.value}</div>
          <div className="text-[10px] text-slate-500 mt-1">{c.label}</div>
        </motion.div>
      ))}
    </div>
  )
}

// ── Transaction type radar ────────────────────────────────────────────────────

function TxTypeRadar({ data, loading }) {
  if (loading) return <Skeleton />
  const types = data?.types ?? []
  if (!types.length) return <p className="text-slate-600 text-sm text-center py-12">No data</p>

  const radarData = types.slice(0, 8).map(t => ({
    type: t.tx_type?.replace(/([A-Z])/g, ' $1').trim() ?? t.tx_type,
    count: t.count,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={radarData}>
        <PolarGrid stroke="#2a3045" />
        <PolarAngleAxis dataKey="type" tick={{ fill: '#64748b', fontSize: 9 }} />
        <Radar name="Count" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} strokeWidth={2} />
        <Tooltip content={<CustomTooltip formatter={v => `${v.toLocaleString()} txns`} />} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── Bollinger band volume ─────────────────────────────────────────────────────

function BollingerChart({ data, loading }) {
  if (loading) return <Skeleton h={200} />
  const points = data?.points ?? []
  if (!points.length) return <p className="text-slate-600 text-sm text-center py-12">No data</p>

  // Sample to max 100 points to keep chart readable
  const step = Math.max(1, Math.floor(points.length / 100))
  const sampled = points.filter((_, i) => i % step === 0)
  const spikes = sampled.filter(p => p.is_spike)

  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={sampled}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2035" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.floor(sampled.length / 8)} />
          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v} />
          <Tooltip content={<CustomTooltip formatter={v => `${(+v).toFixed(2)} XRP`} />} />
          <Area type="monotone" dataKey="upper" stroke="#3b82f620" fill="#3b82f610" strokeWidth={1} dot={false} name="Upper" />
          <Area type="monotone" dataKey="lower" stroke="#3b82f620" fill="#0a0e1a" strokeWidth={1} dot={false} name="Lower" />
          <Line type="monotone" dataKey="sma" stroke="#3b82f660" strokeWidth={1} dot={false} strokeDasharray="4 2" name="SMA" />
          <Line type="monotone" dataKey="volume" stroke="#10b981" strokeWidth={2} dot={false} name="Volume (XRP)" activeDot={{ r: 4 }} />
          {spikes.slice(0, 8).map((s, i) => (
            <ReferenceLine key={i} x={s.time} stroke="#ef4444" strokeWidth={1} strokeDasharray="2 2" />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Volume (XRP)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500/40 inline-block rounded" /> Bollinger Bands</span>
        <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-red-500 inline-block rounded" /> Spike ({spikes.length})</span>
      </div>
    </>
  )
}

// ── Top wallet pairs ──────────────────────────────────────────────────────────

function WalletPairsTable({ data, loading }) {
  if (loading) return <Skeleton h={180} />
  const pairs = data?.pairs ?? []
  if (!pairs.length) return <p className="text-slate-600 text-sm text-center py-8">No data</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#2a3045]">
            {['#', 'From', 'To', 'Volume (XRP)', 'Txns'].map(h => (
              <th key={h} className="text-left text-[10px] text-slate-600 uppercase tracking-wider font-semibold pb-2 pr-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, i) => (
            <tr key={i} className="border-b border-[#2a3045]/40 hover:bg-[#242938] transition-colors">
              <td className="py-2 pr-4 text-slate-600">{i + 1}</td>
              <td className="py-2 pr-4 font-mono text-blue-400">{p.from_account?.slice(0, 8)}...{p.from_account?.slice(-4)}</td>
              <td className="py-2 pr-4 font-mono text-purple-400">{p.to_account?.slice(0, 8)}...{p.to_account?.slice(-4)}</td>
              <td className="py-2 pr-4 font-mono text-emerald-400">
                {p.volume_xrp >= 1000 ? `${(p.volume_xrp/1000).toFixed(2)}K` : p.volume_xrp.toFixed(2)}
              </td>
              <td className="py-2 text-slate-400">{p.tx_count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Top anomalous accounts ────────────────────────────────────────────────────

function TopAccountsTable({ data, loading }) {
  if (loading) return <Skeleton h={180} />
  const accounts = data?.accounts ?? []
  if (!accounts.length) return <p className="text-slate-600 text-sm text-center py-8">No data</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#2a3045]">
            {['Address', 'Tx Count', 'Anomalies', 'IF Score'].map(h => (
              <th key={h} className="text-left text-[10px] text-slate-600 uppercase tracking-wider font-semibold pb-2 pr-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.slice(0, 10).map((acc, i) => {
            const score = acc.isolation_score ?? 0
            const color = score >= 0.7 ? '#f87171' : score >= 0.4 ? '#fbbf24' : '#34d399'
            return (
              <tr key={i} className="border-b border-[#2a3045]/40 hover:bg-[#242938] transition-colors">
                <td className="py-2 pr-4 font-mono text-blue-400">{acc.address?.slice(0, 10)}...{acc.address?.slice(-4)}</td>
                <td className="py-2 pr-4 text-slate-400">{(acc.tx_count ?? 0).toLocaleString()}</td>
                <td className="py-2 pr-4 text-red-400">{acc.anomaly_count ?? 0}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#0a0e1a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.round(score * 100)}%`, background: color }} />
                    </div>
                    <span className="font-mono text-[10px]" style={{ color }}>{score.toFixed(3)}</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Tx type bar chart ─────────────────────────────────────────────────────────

function TxTypeBar({ data, loading }) {
  if (loading) return <Skeleton />
  const types = data?.types ?? []
  if (!types.length) return null

  const chartData = types.slice(0, 10).map((t, i) => ({
    type: t.tx_type ?? 'Unknown',
    count: t.count,
    pct: t.percentage,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }))

  const chartHeight = chartData.length * 36 + 20

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={chartData} layout="vertical" barSize={18} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a2035" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
          tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
        <YAxis type="category" dataKey="type" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
        <Tooltip content={<CustomTooltip formatter={v => `${(+v).toLocaleString()} txns`} />} />
        <Bar dataKey="count" name="Count" radius={[0, 3, 3, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TIME_WINDOWS = ['1h', '6h', '24h', '7d']

export default function Analytics() {
  const [timeWindow, setTimeWindow] = useState('24h')

  const { data: volumeData, loading: volumeLoading } = useVolume(timeWindow)
  const { data: topAccountsData, loading: topAccountsLoading } = useTopAccounts()
  const { data: txTypesData, loading: txTypesLoading } = useTxTypes()
  const { data: walletPairsData, loading: walletPairsLoading } = useWalletPairs(10)
  const { data: volumeSeriesData, loading: volumeSeriesLoading } = useVolumeSeries()

  return (
    <div className="space-y-6">
      {/* Time window selector */}
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-500" />
        <span className="text-xs text-slate-500">Window:</span>
        <div className="flex gap-1">
          {TIME_WINDOWS.map(w => (
            <button key={w} onClick={() => setTimeWindow(w)}
              className={`px-2.5 py-1 rounded text-xs font-medium uppercase transition-colors ${
                timeWindow === w ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}>
              {w}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-blue-400 font-mono">All data from backend · real XRPL transactions</span>
      </div>

      {/* Volume summary cards */}
      {volumeData && <VolumeSummaryCards data={volumeData} />}

      {/* Volume chart */}
      <Card>
        <CardHeader icon={TrendingUp} title="Volume Over Time (Raw vs Adjusted)" badge={timeWindow} />
        <VolumeChart data={volumeData} loading={volumeLoading} />
      </Card>

      {/* Two charts: tx type radar + tx type bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader icon={Activity} title="Transaction Type Distribution" iconColor="text-purple-400" />
          <TxTypeRadar data={txTypesData} loading={txTypesLoading} />
        </Card>
        <Card>
          <CardHeader icon={BarChart2} title="Transaction Type Counts" iconColor="text-blue-400" />
          <TxTypeBar data={txTypesData} loading={txTypesLoading} />
        </Card>
      </div>

      {/* Bollinger band volume series */}
      <Card>
        <CardHeader icon={TrendingUp} title="Volume Spike Detection — Bollinger Bands (per minute)" iconColor="text-emerald-400"
          badge={`${volumeSeriesData?.points?.filter(p => p.is_spike).length ?? 0} spikes`} />
        <BollingerChart data={volumeSeriesData} loading={volumeSeriesLoading} />
      </Card>

      {/* Wallet pairs + top accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader icon={Users} title="Top Wallet Pairs by Transaction Count" iconColor="text-yellow-400" />
          <WalletPairsTable data={walletPairsData} loading={walletPairsLoading} />
        </Card>
        <Card>
          <CardHeader icon={Users} title="Top Accounts — Isolation Forest Score" iconColor="text-red-400" />
          <TopAccountsTable data={topAccountsData} loading={topAccountsLoading} />
        </Card>
      </div>
    </div>
  )
}
