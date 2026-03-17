import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, ChevronRight, Check, Loader2, Zap,
  Database, Cpu, Brain, Globe, HardDrive, Shield as ShieldIcon,
  Clock, DollarSign, ArrowRight, ExternalLink
} from 'lucide-react'
import AgentCard from './AgentCard.jsx'
import { MOCK_AGENTS } from '../utils/mockData.js'
import { submitAgentPayment, truncateAddress, formatAmount } from '../utils/xrpl.js'
import { formatDistanceToNow } from 'date-fns'

const TASK_CATEGORIES = [
  { id: 'data', label: 'Data Analysis', icon: Database, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', desc: 'Pattern recognition, ETL, insights' },
  { id: 'compute', label: 'Compute', icon: Cpu, color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', desc: 'Distributed computation tasks' },
  { id: 'training', label: 'Model Training', icon: Brain, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', desc: 'ML training & fine-tuning' },
  { id: 'api', label: 'API Access', icon: Globe, color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20', desc: 'API aggregation & bridging' },
  { id: 'storage', label: 'Storage', icon: HardDrive, color: 'text-green-400 bg-green-400/10 border-green-400/20', desc: 'Decentralized file storage' },
  { id: 'validation', label: 'Validation', icon: ShieldIcon, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', desc: 'ZK proofs & auditing' },
]

const SPECIALTY_MAP = {
  data: 'Data Analysis',
  compute: 'Compute',
  training: 'Model Training',
  api: 'API Access',
  storage: 'Storage',
  validation: 'Validation',
}

const PAYMENT_STATES = ['idle', 'submitting', 'broadcasting', 'confirmed', 'error']

function PaymentModal({ agent, onClose, onSuccess }) {
  const [amount, setAmount] = useState(agent.pricePerTask)
  const [paymentState, setPaymentState] = useState('idle')
  const [txResult, setTxResult] = useState(null)

  const protocolFee = Math.round(amount * 0.001 * 1000) / 1000
  const total = Math.round((amount + protocolFee) * 1000) / 1000
  const estimatedTime = agent.avgCompletionTime

  const handleSubmit = async () => {
    setPaymentState('submitting')

    try {
      // Simulate state transitions
      setTimeout(() => setPaymentState('broadcasting'), 800)

      const result = await submitAgentPayment(
        'rRequesterDemoWallet123456789',
        agent.address,
        amount,
        'RLUSD'
      )

      setTxResult(result)
      setPaymentState('confirmed')

      // Notify parent after delay
      setTimeout(() => {
        onSuccess?.({
          agent,
          amount,
          result,
          timestamp: new Date().toISOString(),
        })
      }, 1500)
    } catch (err) {
      setPaymentState('error')
    }
  }

  const stateConfig = {
    idle: { label: 'Submit Payment', cls: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500' },
    submitting: { label: 'Signing transaction...', cls: 'bg-slate-700 cursor-not-allowed' },
    broadcasting: { label: 'Broadcasting to XRPL...', cls: 'bg-slate-700 cursor-not-allowed' },
    confirmed: { label: 'Payment Confirmed!', cls: 'bg-emerald-600 cursor-not-allowed' },
    error: { label: 'Retry Payment', cls: 'bg-red-600 hover:bg-red-500' },
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-[#1a1f2e] border border-[#2a3045] rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-100">Hire {agent.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">RLUSD payment via x402 Protocol</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Agent summary */}
        <div className="bg-[#0a0e1a] rounded-xl p-4 mb-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center text-2xl">
            {agent.icon || '🤖'}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-200">{agent.name}</div>
            <div className="text-xs text-slate-500">{agent.specialty}</div>
            <div className="text-xs text-slate-600 font-mono mt-0.5">{truncateAddress(agent.address)}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-sm font-bold text-emerald-400">{agent.reputationScore}%</div>
            <div className="text-[10px] text-slate-600">Reputation</div>
          </div>
        </div>

        {/* Amount slider */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-slate-300 mb-3">
            Payment Amount
          </label>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="range"
              min="0.1"
              max="100"
              step="0.1"
              value={amount}
              onChange={e => setAmount(parseFloat(e.target.value))}
              disabled={paymentState !== 'idle' && paymentState !== 'error'}
              className="flex-1 accent-blue-500 cursor-pointer"
            />
            <div className="bg-[#0a0e1a] border border-[#2a3045] rounded-lg px-3 py-2 min-w-[80px] text-center">
              <div className="text-sm font-bold font-mono text-emerald-400">{amount.toFixed(1)}</div>
              <div className="text-[10px] text-slate-600">RLUSD</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>0.1 RLUSD min</span>
            <span>100 RLUSD max</span>
          </div>
        </div>

        {/* Fee breakdown */}
        <div className="bg-[#0a0e1a] rounded-xl p-4 mb-5 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Task Payment</span>
            <span className="text-slate-300 font-mono">{amount.toFixed(3)} RLUSD</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Protocol Fee (0.1%)</span>
            <span className="text-slate-300 font-mono">{protocolFee.toFixed(5)} RLUSD</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">XRPL Network Fee</span>
            <span className="text-slate-300 font-mono">0.000012 XRP</span>
          </div>
          <div className="border-t border-[#2a3045] pt-2 flex justify-between text-sm">
            <span className="font-semibold text-slate-300">Total</span>
            <span className="font-bold text-emerald-400 font-mono">{total.toFixed(3)} RLUSD</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
            <Clock className="w-3 h-3" />
            <span>Est. completion: {estimatedTime}</span>
          </div>
        </div>

        {/* Confirmed result */}
        <AnimatePresence>
          {paymentState === 'confirmed' && txResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mb-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-300">Transaction Confirmed</span>
              </div>
              <div className="text-xs text-slate-400 font-mono break-all">
                {txResult.hash}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Ledger #{txResult.ledgerIndex?.toLocaleString()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit button */}
        <button
          onClick={paymentState === 'idle' || paymentState === 'error' ? handleSubmit : undefined}
          disabled={paymentState === 'submitting' || paymentState === 'broadcasting' || paymentState === 'confirmed'}
          className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${stateConfig[paymentState].cls}`}
        >
          {(paymentState === 'submitting' || paymentState === 'broadcasting') && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          {paymentState === 'confirmed' && <Check className="w-4 h-4" />}
          {stateConfig[paymentState].label}
        </button>

        {paymentState === 'idle' && (
          <p className="text-center text-[10px] text-slate-600 mt-2">
            Powered by XRPL • x402 Protocol • RLUSD
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}

function ProtocolFlowPanel() {
  const steps = [
    { icon: '👤', label: 'Task Request', desc: 'Requester specifies task requirements', color: '#3b82f6' },
    { icon: '🔍', label: 'Agent Discovery', desc: 'Protocol matches optimal AI agent', color: '#8b5cf6' },
    { icon: '💰', label: 'x402 Payment', desc: 'RLUSD locked in smart escrow', color: '#06b6d4' },
    { icon: '⚡', label: 'XRPL Broadcast', desc: 'Transaction validated on ledger', color: '#10b981' },
    { icon: '🤖', label: 'Agent Executes', desc: 'AI provider processes the task', color: '#f59e0b' },
    { icon: '✅', label: 'Settlement', desc: 'Payment released on delivery', color: '#10b981' },
  ]

  return (
    <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5 h-fit">
      <h3 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
        <Zap className="w-4 h-4 text-yellow-400" />
        x402 Protocol Flow
      </h3>
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={step.label} className="flex gap-3">
            {/* Connector */}
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 border"
                style={{ borderColor: `${step.color}40`, background: `${step.color}15` }}
              >
                {step.icon}
              </div>
              {i < steps.length - 1 && (
                <div className="w-px h-6 bg-gradient-to-b from-[#2a3045] to-transparent my-1" />
              )}
            </div>
            {/* Content */}
            <div className={`pb-${i < steps.length - 1 ? '0' : '0'} pt-1`}>
              <div className="text-xs font-semibold text-slate-300">{step.label}</div>
              <div className="text-[10px] text-slate-600 leading-relaxed mb-3">{step.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Marketplace({ transactions }) {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [search, setSearch] = useState('')
  const [hiringAgent, setHiringAgent] = useState(null)
  const [hireHistory, setHireHistory] = useState([])

  const filteredAgents = MOCK_AGENTS.filter(agent => {
    const matchesCategory = !selectedCategory || agent.specialty === SPECIALTY_MAP[selectedCategory]
    const matchesSearch = !search ||
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.specialty.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleHireSuccess = (hire) => {
    setHireHistory(prev => [hire, ...prev].slice(0, 5))
    setTimeout(() => setHiringAgent(null), 2500)
  }

  return (
    <div className="space-y-6">
      {/* Category selector */}
      <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Select Task Category</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {TASK_CATEGORIES.map(cat => {
            const Icon = cat.icon
            const isSelected = selectedCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                className={`p-3 rounded-xl border transition-all duration-200 text-left group ${
                  isSelected
                    ? `${cat.color} border-current`
                    : 'bg-[#0a0e1a] border-[#2a3045] hover:border-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 mb-2 ${isSelected ? '' : 'text-slate-500 group-hover:text-slate-400'}`} />
                <div className="text-xs font-semibold text-slate-200 leading-tight">{cat.label}</div>
                <div className="text-[10px] text-slate-600 mt-0.5 leading-tight hidden sm:block">{cat.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main content */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search agents by name or specialty..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#1a1f2e] border border-[#2a3045] rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* Agent grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredAgents.map((agent, i) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  index={i}
                  onHire={setHiringAgent}
                />
              ))}
            </AnimatePresence>
            {filteredAgents.length === 0 && (
              <div className="col-span-full text-center py-16 text-slate-600">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No agents match your search</p>
              </div>
            )}
          </div>

          {/* Hire history table */}
          {hireHistory.length > 0 && (
            <div className="bg-[#1a1f2e] border border-[#2a3045] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Recent Hires
              </h3>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Specialty</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hireHistory.map((hire, i) => (
                      <tr key={i}>
                        <td className="font-medium text-slate-200">{hire.agent.name}</td>
                        <td>
                          <span className="text-xs text-slate-400">{hire.agent.specialty}</span>
                        </td>
                        <td className="font-mono text-emerald-400">{hire.amount.toFixed(3)} RLUSD</td>
                        <td>
                          <span className="badge badge-trust">Confirmed</span>
                        </td>
                        <td className="text-slate-500">
                          {formatDistanceToNow(new Date(hire.timestamp), { addSuffix: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Protocol flow sidebar */}
        <ProtocolFlowPanel />
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {hiringAgent && (
          <PaymentModal
            agent={hiringAgent}
            onClose={() => setHiringAgent(null)}
            onSuccess={handleHireSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
