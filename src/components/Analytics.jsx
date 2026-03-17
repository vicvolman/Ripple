import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, ReferenceLine, Area, AreaChart, ComposedChart
} from 'recharts'
import { motion } from 'framer-motion'
import { TrendingUp, Grid, BarChart2, Activity, Users } from 'lucide-react'
import {
  generateDailyVolumeData,
  generateHeatmapData,
  generateBollingerData,
  getTopAgentPairs,
  HISTORICAL_TRANSACTIONS,
} from '../utils/mockData.js'
import { computeRadarData } from '../utils/mlModels.js'

// Custom tooltip base
const CustomTooltipBase = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-lg p-3 shadow-xl text-xs">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold font-mono" style={{ color: p.color }}>
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// 7-Day Volume Bar Chart
function VolumeBarChart({ data }) {
  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-slate-200">7-Day RLUSD Volume</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={2} barSize={18}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2035" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v}
          />
          <Tooltip
            content={
              <CustomTooltipBase
                formatter={(v, name) => `${parseFloat(v).toFixed(2)} RLUSD`}
              />
            }
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
          />
          <Bar dataKey="normalVolume" name="Normal Volume" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="anomalousVolume" name="Anomalous Volume" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Radar chart
function TxTypeRadarChart({ data }) {
  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold text-slate-200">Transaction Type Distribution</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={data}>
          <PolarGrid stroke="#2a3045" />
          <PolarAngleAxis
            dataKey="type"
            tick={{ fill: '#64748b', fontSize: 10 }}
          />
          <Radar
            name="Count"
            dataKey="count"
            stroke="#8b5cf6"
            fill="#8b5cf6"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            content={<CustomTooltipBase formatter={(v) => `${v} txns`} />}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Heatmap cell
function HeatmapCell({ cell, maxVolume }) {
  const [tooltip, setTooltip] = useState(false)
  const intensity = maxVolume > 0 ? cell.volume / maxVolume : 0

  let bg
  if (cell.hasAnomaly) {
    bg = `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`
  } else if (intensity > 0) {
    const r = Math.round(59 + (139 - 59) * intensity)
    const g = Math.round(130 - 130 * intensity)
    const b = Math.round(246 - 100 * intensity)
    bg = `rgba(${r}, ${g}, ${b}, ${0.15 + intensity * 0.7})`
  } else {
    bg = 'rgba(42, 48, 69, 0.3)'
  }

  return (
    <div
      className="heatmap-cell rounded-sm relative"
      style={{ background: bg, width: '100%', paddingBottom: '90%' }}
      onMouseEnter={() => setTooltip(true)}
      onMouseLeave={() => setTooltip(false)}
    >
      {cell.hasAnomaly && (
        <div className="absolute inset-0 rounded-sm animate-ping-slow"
          style={{ background: 'rgba(239, 68, 68, 0.3)' }}
        />
      )}
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 bg-[#1a1f2e] border border-[#2a3045] rounded-lg px-2 py-1.5 text-[10px] text-slate-300 whitespace-nowrap shadow-xl pointer-events-none">
          <div>{cell.dayLabel} {String(cell.hour).padStart(2, '0')}:00</div>
          <div className="font-mono text-emerald-400">{cell.volume.toFixed(1)} RLUSD</div>
          <div className="text-slate-500">{cell.txCount} txns</div>
          {cell.hasAnomaly && <div className="text-red-400">⚠ Anomaly</div>}
        </div>
      )}
    </div>
  )
}

function HeatmapGrid({ data }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const maxVolume = Math.max(...data.map(d => d.volume), 1)

  const grouped = useMemo(() => {
    const result = []
    for (let d = 0; d < 7; d++) {
      result.push(data.filter(cell => cell.day === d))
    }
    return result
  }, [data])

  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Grid className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-slate-200">24×7 Transaction Heatmap</span>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(59, 130, 246, 0.4)' }} />
          Normal
          <span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(239, 68, 68, 0.6)' }} />
          Anomaly
        </div>
      </div>

      {/* Hour labels */}
      <div className="flex mb-1 pl-8">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="flex-1 text-center text-[8px] text-slate-700">
            {h % 4 === 0 ? String(h).padStart(2, '0') : ''}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-0.5">
        {grouped.map((dayData, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-0.5">
            <div className="text-[9px] text-slate-600 w-7 text-right pr-1 shrink-0">
              {dayData[0]?.dayLabel || days[dayIdx]}
            </div>
            {dayData.map((cell, hourIdx) => (
              <div key={hourIdx} className="flex-1">
                <HeatmapCell cell={cell} maxVolume={maxVolume} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend scale */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[9px] text-slate-600">Low</span>
        <div className="flex-1 h-1.5 rounded" style={{
          background: 'linear-gradient(90deg, rgba(42,48,69,0.3), rgba(59,130,246,0.8))'
        }} />
        <span className="text-[9px] text-slate-600">High</span>
      </div>
    </div>
  )
}

// Bollinger bands chart
function BollingerChart({ data }) {
  const spikes = data.filter(d => d.isSpike)

  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-semibold text-slate-200">Volume Spike Detection (48h)</span>
        <span className="ml-auto text-xs text-red-400 font-mono">{spikes.length} spikes</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2035" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: '#64748b', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval={7}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v}
          />
          <Tooltip content={<CustomTooltipBase formatter={(v) => `${parseFloat(v).toFixed(1)} RLUSD`} />} />

          {/* Bollinger bands */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="#3b82f620"
            fill="#3b82f610"
            strokeWidth={1}
            dot={false}
            name="Upper Band"
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="#3b82f620"
            fill="#0a0e1a"
            strokeWidth={1}
            dot={false}
            name="Lower Band"
          />
          <Line
            type="monotone"
            dataKey="sma"
            stroke="#3b82f660"
            strokeWidth={1}
            dot={false}
            strokeDasharray="4 2"
            name="SMA"
          />
          <Line
            type="monotone"
            dataKey="volume"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            name="Volume"
            activeDot={{ r: 4, fill: '#10b981' }}
          />

          {/* Spike markers */}
          {spikes.slice(0, 5).map((spike, i) => (
            <ReferenceLine
              key={i}
              x={spike.time}
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-[10px]">
        <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-emerald-500 rounded" /> Volume</div>
        <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-blue-500/40 rounded" /> Bollinger Bands</div>
        <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-blue-500/30 rounded border-dashed" /> SMA</div>
        <div className="flex items-center gap-1"><div className="w-0.5 h-3 bg-red-500 rounded" /> Spike</div>
      </div>
    </div>
  )
}

// Top agent pairs table
function AgentPairsTable({ pairs }) {
  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-semibold text-slate-200">Top Agent Pairs by Volume</span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>From</th>
              <th>To</th>
              <th>Volume (RLUSD)</th>
              <th>Txns</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair, i) => (
              <tr key={pair.key || i}>
                <td className="text-slate-600 text-xs">{i + 1}</td>
                <td className="font-mono text-xs text-blue-400">{pair.fromShort}</td>
                <td className="font-mono text-xs text-purple-400">{pair.toShort}</td>
                <td className="font-mono text-xs font-semibold text-emerald-400">
                  {pair.volume >= 1000
                    ? `${(pair.volume / 1000).toFixed(2)}K`
                    : pair.volume.toFixed(2)
                  }
                </td>
                <td className="text-xs text-slate-400">{pair.txCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Analytics({ transactions }) {
  const dailyData = useMemo(() => generateDailyVolumeData(), [])
  const heatmapData = useMemo(() => generateHeatmapData(), [])
  const bollingerData = useMemo(() => generateBollingerData(), [])
  const topPairs = useMemo(() => getTopAgentPairs(), [])
  const radarData = useMemo(() => computeRadarData(HISTORICAL_TRANSACTIONS), [])

  // Summary stats
  const totalVolume = dailyData.reduce((s, d) => s + d.normalVolume + d.anomalousVolume, 0)
  const peakDay = dailyData.reduce((max, d) => (d.normalVolume + d.anomalousVolume) > (max.normalVolume + max.anomalousVolume) ? d : max, dailyData[0] || {})
  const avgDailyTx = dailyData.length > 0
    ? Math.round(dailyData.reduce((s, d) => s + d.totalTx, 0) / dailyData.length)
    : 0

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '7-Day Volume', value: `${(totalVolume / 1000).toFixed(2)}K`, sub: 'RLUSD', icon: '📊' },
          { label: 'Peak Day', value: peakDay.date || '-', sub: `${((peakDay.normalVolume || 0) + (peakDay.anomalousVolume || 0)).toFixed(0)} RLUSD`, icon: '📈' },
          { label: 'Avg Daily Txns', value: avgDailyTx, sub: 'transactions/day', icon: '⚡' },
          { label: 'Anomaly Volume', value: `${dailyData.reduce((s, d) => s + d.anomalousVolume, 0).toFixed(0)}`, sub: 'RLUSD flagged', icon: '⚠️' },
        ].map(stat => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4 flex items-center gap-3"
          >
            <div className="text-2xl">{stat.icon}</div>
            <div>
              <div className="text-lg font-bold text-slate-100 font-mono">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
              <div className="text-[10px] text-slate-600">{stat.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VolumeBarChart data={dailyData} />
        <TxTypeRadarChart data={radarData} />
      </div>

      {/* Heatmap - full width */}
      <HeatmapGrid data={heatmapData} />

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BollingerChart data={bollingerData} />
        <AgentPairsTable pairs={topPairs} />
      </div>
    </div>
  )
}
