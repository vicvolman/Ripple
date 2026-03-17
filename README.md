# Ripple

Real-time analytics platform for the XRP Ledger, built for Challenge 2: Analytics.

## What it does

Ripple streams live transactions from the XRP Ledger and uses machine learning to make sense of them in real time:

- **Transaction Streaming** — connects to the XRP Ledger via WebSocket to ingest live payment, token transfer, and escrow data as it happens
- **ML Classification & Aggregation** — automatically classifies transaction types and aggregates key metrics (volume, flow, frequency) using ML tools
- **Anomaly Detection** — flags suspicious activity, unusual spikes, or abnormal patterns in token transfers, payment channels, and escrow usage
- **Interactive Dashboard** — visualizes everything in a responsive UI with alerts, transaction heatmaps, volume spike charts, and token flow graphs, with filtering and time-based views

## Stack

- **Backend:** Python / FastAPI — XRP Ledger WebSocket streaming + ML pipeline
- **ML:** scikit-learn / PyOD — anomaly detection and transaction classification
- **Frontend:** React — real-time charts, heatmaps, and token flow graphs

## Getting Started

Coming soon.
