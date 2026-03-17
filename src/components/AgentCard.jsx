import { Star, Zap, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

const SPECIALTY_COLORS = {
  'Data Analysis': 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  'Compute': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  'Model Training': 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  'API Access': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  'Storage': 'text-green-400 bg-green-400/10 border-green-400/30',
  'Validation': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
}

const SPECIALTY_ICONS = {
  'Data Analysis': '🧠',
  'Compute': '⚡',
  'Model Training': '🔬',
  'API Access': '🔗',
  'Storage': '💾',
  'Validation': '✅',
}

function StarRating({ rating }) {
  const full = Math.floor(rating)
  const half = rating % 1 >= 0.5
  const empty = 5 - full - (half ? 1 : 0)

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }, (_, i) => (
        <Star key={`f-${i}`} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
      ))}
      {half && <Star className="w-3 h-3 fill-yellow-400/50 text-yellow-400" />}
      {Array.from({ length: empty }, (_, i) => (
        <Star key={`e-${i}`} className="w-3 h-3 text-gray-600" />
      ))}
      <span className="text-xs text-yellow-400 ml-1 font-semibold">{rating.toFixed(1)}</span>
    </div>
  )
}

function ReputationBar({ score }) {
  const color = score >= 97 ? 'bg-emerald-500' : score >= 93 ? 'bg-blue-500' : 'bg-yellow-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#2a3045] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-mono text-slate-300">{score.toFixed(1)}%</span>
    </div>
  )
}

export default function AgentCard({ agent, onHire, index = 0 }) {
  const specialtyColor = SPECIALTY_COLORS[agent.specialty] || 'text-slate-400 bg-slate-400/10 border-slate-400/30'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5 flex flex-col gap-4 hover:border-blue-500/40 hover:shadow-glow-blue transition-all duration-300 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center text-xl">
            {agent.icon || SPECIALTY_ICONS[agent.specialty] || '🤖'}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
              {agent.name}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${specialtyColor} font-medium`}>
              {agent.specialty}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-emerald-400">{agent.pricePerTask} RLUSD</div>
          <div className="text-xs text-slate-500">per task</div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
        {agent.description}
      </p>

      {/* Rating */}
      <StarRating rating={agent.rating} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#0a0e1a] rounded-lg p-2.5 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-slate-200">{agent.totalJobs.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500">Total Jobs</div>
          </div>
        </div>
        <div className="bg-[#0a0e1a] rounded-lg p-2.5 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-slate-200">{agent.avgCompletionTime}</div>
            <div className="text-[10px] text-slate-500">Avg Time</div>
          </div>
        </div>
        <div className="bg-[#0a0e1a] rounded-lg p-2.5 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-slate-200">{agent.successRate}%</div>
            <div className="text-[10px] text-slate-500">Success Rate</div>
          </div>
        </div>
        <div className="bg-[#0a0e1a] rounded-lg p-2.5 flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-slate-200">{agent.reputationScore}</div>
            <div className="text-[10px] text-slate-500">Reputation</div>
          </div>
        </div>
      </div>

      {/* Reputation bar */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Reputation Score</span>
        </div>
        <ReputationBar score={agent.reputationScore} />
      </div>

      {/* Hire button */}
      <button
        onClick={() => onHire?.(agent)}
        className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-blue-500/25"
      >
        Hire Agent
      </button>
    </motion.div>
  )
}
