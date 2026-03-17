import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, BarChart2, AlertTriangle,
  Wifi, WifiOff, Activity, ChevronRight, Layers
} from 'lucide-react'
import Dashboard from './components/Dashboard.jsx'
import Analytics from './components/Analytics.jsx'
import Anomalies from './components/Anomalies.jsx'
import { useXRPLStream } from './hooks/useXRPLStream.js'
import { useMLClassifier } from './hooks/useMLClassifier.js'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
]

function AnimatedLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 live-dot border-2 border-[#0a0e1a]" />
      </div>
      <div>
        <div className="text-sm font-bold text-white tracking-tight">
          Ripple<span className="gradient-text"> Analytics</span>
        </div>
        <div className="text-[9px] text-slate-600 tracking-widest uppercase">
          XRPL Ledger Insights
        </div>
      </div>
    </div>
  )
}

function NetworkStatus({ isConnected, isMockMode, ledgerIndex, tps }) {
  return (
    <div className="flex items-center gap-4">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 live-dot' : isMockMode ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
        <span className={`text-xs font-medium ${isConnected ? 'text-emerald-400' : isMockMode ? 'text-yellow-400' : 'text-red-400'}`}>
          {isConnected ? 'LIVE' : isMockMode ? 'MOCK' : 'OFFLINE'}
        </span>
      </div>

      {/* Network */}
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
        {isConnected
          ? <Wifi className="w-3.5 h-3.5 text-emerald-500" />
          : <WifiOff className="w-3.5 h-3.5 text-yellow-500" />
        }
        <span>{isConnected ? 'XRPL Mainnet' : 'Mock Mode'}</span>
      </div>

      {/* TPS */}
      {tps > 0 && (
        <div className="hidden md:flex items-center gap-1.5 text-xs">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-mono text-blue-400">{tps.toFixed(1)} TPS</span>
        </div>
      )}

      {/* Ledger */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
        <span className="text-slate-700">Ledger</span>
        <span className="font-mono text-slate-400">#{ledgerIndex?.toLocaleString()}</span>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  // XRPL stream
  const {
    transactions,
    isConnected,
    isMockMode,
    ledgerIndex,
    tps,
  } = useXRPLStream()

  // ML classifier
  const {
    modelStats,
    anomalyQueue,
    dismissAnomaly,
    clearAnomalyQueue,
  } = useMLClassifier(transactions)

  const handleDismissAnomaly = useCallback((id) => {
    dismissAnomaly(id)
  }, [dismissAnomaly])

  const anomalyCount = anomalyQueue.length

  return (
    <div className="min-h-screen bg-[#0a0e1a] grid-bg text-slate-100 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-[#2a3045] bg-[#0a0e1a]/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <AnimatedLogo />

          {/* Tab navigation - desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              const showBadge = tab.id === 'anomalies' && anomalyCount > 0
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-600/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {anomalyCount > 9 ? '9+' : anomalyCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Network status */}
          <NetworkStatus
            isConnected={isConnected}
            isMockMode={isMockMode}
            ledgerIndex={ledgerIndex}
            tps={tps}
          />
        </div>

        {/* Mobile tab nav */}
        <div className="md:hidden border-t border-[#2a3045] flex">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const showBadge = tab.id === 'anomalies' && anomalyCount > 0
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-blue-400' : 'text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {showBadge && (
                  <span className="absolute top-1 right-1/4 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {anomalyCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-5">
          <span>Ripple Analytics</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-400 capitalize">{activeTab}</span>
        </div>

        {/* Mock mode banner */}
        {isMockMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-xs"
          >
            <WifiOff className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-yellow-300">
              Running in mock mode — simulating live XRPL transactions. Real data streams from{' '}
              <span className="font-mono">wss://s1.ripple.com</span> when connected.
            </span>
          </motion.div>
        )}

        {/* Tab panels */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <Dashboard
                transactions={transactions}
                anomalyQueue={anomalyQueue}
                modelStats={modelStats}
                onDismissAnomaly={handleDismissAnomaly}
              />
            )}
            {activeTab === 'analytics' && (
              <Analytics transactions={transactions} />
            )}
            {activeTab === 'anomalies' && (
              <Anomalies
                transactions={transactions}
                anomalyQueue={anomalyQueue}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2a3045] py-4 px-6 mt-auto">
        <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>Powered by</span>
            <span className="text-slate-400 font-semibold">XRPL</span>
            <span>•</span>
            <span className="text-slate-400 font-semibold">RLUSD</span>
          </div>
          <div className="flex items-center gap-4">
            <span>© 2026 Ripple Analytics</span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>All systems operational</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
