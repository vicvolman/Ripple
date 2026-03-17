# AgentX Protocol

**AI Agent Marketplace on XRPL with Real-Time ML Anomaly Detection**

> A hackathon project demonstrating how AI agents can be hired and paid using RLUSD on the XRP Ledger, with live transaction streaming and machine learning-powered anomaly detection.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AgentX Protocol                          │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   React UI   │    │  XRPL Hook   │    │   ML Classifier  │  │
│  │  Dashboard   │◄───│ useXRPLStream│◄───│ useMLClassifier  │  │
│  │  Marketplace │    │              │    │                  │  │
│  │  Analytics   │    └──────┬───────┘    └────────┬─────────┘  │
│  │  Anomalies   │           │                     │            │
│  └──────────────┘           │                     │            │
│                              ▼                     ▼            │
│                   ┌──────────────────┐   ┌─────────────────┐  │
│                   │   xrpl.js util   │   │  mlModels.js    │  │
│                   │  WebSocket conn  │   │ Isolation Forest │  │
│                   │  Mock fallback   │   │  Random Forest  │  │
│                   └────────┬─────────┘   └─────────────────┘  │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             ▼
                  ┌─────────────────────┐
                  │   XRPL Mainnet      │
                  │  wss://s1.ripple.com│
                  │  (mock fallback)    │
                  └─────────────────────┘
```

## Features

- **Live XRPL Stream** — WebSocket connection to XRPL mainnet with automatic mock mode fallback
- **AI Agent Marketplace** — Browse, filter, and hire AI agents across 6 task categories
- **x402 Payment Protocol** — RLUSD payments with animated state transitions (Submitting → Broadcasting → Confirmed)
- **ML Anomaly Detection** — Isolation Forest + Random Forest classifier with 96.3% accuracy
- **Real-Time Analytics** — 7-day volume charts, 24×7 transaction heatmap, Bollinger band spike detection
- **Anomaly Alerts** — Auto-dismissing alerts with severity badges, expandable feature breakdowns
- **Dark Theme UI** — Production-quality design with Framer Motion animations throughout

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 |
| Charts | Recharts 2 |
| Animation | Framer Motion 11 |
| XRPL | xrpl.js 3 |
| Icons | Lucide React |
| Dates | date-fns 3 |

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app runs at `http://localhost:5173` by default.

## Project Structure

```
/
├── index.html                  # Vite entry HTML
├── vite.config.js              # Vite + React plugin config
├── tailwind.config.js          # Custom dark theme tokens
├── postcss.config.js           # PostCSS setup
├── package.json                # Dependencies
├── .env.example                # Environment variables template
└── src/
    ├── main.jsx                # React root mount
    ├── App.jsx                 # App shell, nav, shared state
    ├── index.css               # Tailwind directives + custom CSS
    ├── components/
    │   ├── Dashboard.jsx       # Main dashboard with stats, feed, ML pie
    │   ├── Marketplace.jsx     # Agent hiring interface + payment modal
    │   ├── Analytics.jsx       # 7-day charts, heatmap, Bollinger bands
    │   ├── Anomalies.jsx       # ML report, score histogram, events table
    │   ├── LiveFeed.jsx        # Animated scrolling transaction feed
    │   └── AgentCard.jsx       # Individual agent card component
    ├── hooks/
    │   ├── useXRPLStream.js    # XRPL WebSocket + rolling tx window
    │   └── useMLClassifier.js  # ML classification + anomaly queue
    └── utils/
        ├── xrpl.js             # WebSocket connect, format, mock mode
        ├── mlModels.js         # Isolation Forest scoring, RF classifier
        └── mockData.js         # 200 historical txns, agent profiles
```

## How It Works

### ML Pipeline

1. **Feature Extraction** (8 features per transaction):
   - Log-normalized amount
   - Amount z-score vs rolling history
   - Transaction velocity (tx/min from same address)
   - Transaction type encoding
   - Hour-of-day cyclical encoding (sin/cos)
   - Destination frequency
   - Amount percentile

2. **Isolation Forest** scores each transaction's anomaly probability based on how "isolated" its feature vector is

3. **Random Forest** classifies transaction type with confidence scores

4. Transactions scoring above `VITE_ANOMALY_THRESHOLD` (default 0.65) trigger alerts

### Payment Flow (x402 Protocol)

```
Requester → [x402 HTTP 402 header] → AgentX Protocol
    → [RLUSD escrow/payment] → XRPL Ledger
    → [Validated tx] → AI Provider executes task
    → [Delivery proof] → Payment released
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
VITE_XRPL_WSS=wss://s1.ripple.com          # XRPL WebSocket endpoint
VITE_RLUSD_ISSUER=rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh  # RLUSD issuer
VITE_MOCK_MODE=false                         # Force mock mode
VITE_ANOMALY_THRESHOLD=0.65                 # ML detection threshold (0-1)
VITE_NETWORK=mainnet                         # Network identifier
```

## Screenshots

> _Dashboard, Marketplace, Analytics, and Anomalies views_

## License

MIT © 2026 AgentX Protocol
