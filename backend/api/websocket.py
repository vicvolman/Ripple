"""
WebSocket endpoint for live XRPL anomaly data streaming.

Endpoint: /ws/live

On connect: sends a `hello` message with current stats.
Every 5 seconds: broadcasts `ledger_update` with latest ledger, recent anomalies, running totals.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import text

from database import AsyncSessionLocal

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory registry of connected WebSocket clients
_connected_clients: list[WebSocket] = []

BROADCAST_INTERVAL_SECONDS = 5
RECENT_ANOMALY_WINDOW_MINUTES = 2


# ---------------------------------------------------------------------------
# Helper: fetch current stats snapshot
# ---------------------------------------------------------------------------

async def _fetch_stats() -> dict[str, Any]:
    """Query the DB for a lightweight stats snapshot."""
    try:
        async with AsyncSessionLocal() as session:
            # Latest ledger
            ledger_result = await session.execute(
                text(
                    "SELECT ledger_index, close_time, transaction_count, total_coins "
                    "FROM ledger_closes ORDER BY ledger_index DESC LIMIT 1"
                )
            )
            ledger_row = ledger_result.fetchone()
            latest_ledger = (
                {
                    "ledger_index": ledger_row[0],
                    "close_time": ledger_row[1],
                    "transaction_count": ledger_row[2],
                    "total_coins": ledger_row[3],
                }
                if ledger_row
                else {}
            )

            # Total counts
            tx_count = (await session.execute(text("SELECT COUNT(*) FROM transactions"))).scalar() or 0
            anomaly_count = (await session.execute(text("SELECT COUNT(*) FROM anomaly_flags"))).scalar() or 0

            # Recent anomalies (last 2 minutes based on timestamp string prefix or rowid)
            # Since timestamps may not be wall-clock recent, we fall back to most recent by id
            recent_result = await session.execute(
                text(
                    "SELECT id, anomaly_type, ledger_index, attacker_address, victim_address, "
                    "       asset_pair, profit_xrp, confidence_score, tx_hashes, timestamp "
                    "FROM anomaly_flags ORDER BY id DESC LIMIT 20"
                )
            )
            recent_anomaly_keys = [
                "id", "anomaly_type", "ledger_index", "attacker_address", "victim_address",
                "asset_pair", "profit_xrp", "confidence_score", "tx_hashes", "timestamp",
            ]
            recent_anomalies = [
                {k: v for k, v in zip(recent_anomaly_keys, row)}
                for row in recent_result.fetchall()
            ]

            # Anomaly breakdown
            anom_breakdown = await session.execute(
                text("SELECT anomaly_type, COUNT(*) FROM anomaly_flags GROUP BY anomaly_type")
            )
            anomaly_by_type = {r[0]: r[1] for r in anom_breakdown.fetchall()}

            return {
                "latest_ledger": latest_ledger,
                "recent_anomalies": recent_anomalies,
                "totals": {
                    "tx_count": tx_count,
                    "anomaly_count": anomaly_count,
                    "anomaly_by_type": anomaly_by_type,
                },
                "server_time": datetime.now(tz=timezone.utc).isoformat(),
            }
    except Exception as exc:
        logger.error("Error fetching WebSocket stats: %s", exc)
        return {"error": str(exc), "server_time": datetime.now(tz=timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await websocket.accept()
    _connected_clients.append(websocket)
    logger.info("WebSocket client connected. Total clients: %d", len(_connected_clients))

    try:
        # Send hello with current stats
        stats = await _fetch_stats()
        await websocket.send_text(
            json.dumps({"type": "hello", "data": stats})
        )

        # Keep connection alive, echoing pings
        while True:
            try:
                # Wait for client messages (ping / close frames)
                data = await asyncio.wait_for(websocket.receive_text(), timeout=BROADCAST_INTERVAL_SECONDS)
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                except Exception:
                    pass
            except asyncio.TimeoutError:
                # No message from client — that is fine; broadcast is handled by background loop
                pass

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
    finally:
        if websocket in _connected_clients:
            _connected_clients.remove(websocket)
        logger.info("WebSocket clients remaining: %d", len(_connected_clients))


# ---------------------------------------------------------------------------
# Background broadcast loop
# ---------------------------------------------------------------------------

async def start_broadcast_loop():
    """
    Asyncio background task: every BROADCAST_INTERVAL_SECONDS, push a
    `ledger_update` message to all connected WebSocket clients.
    """
    logger.info("WebSocket broadcast loop started.")
    while True:
        await asyncio.sleep(BROADCAST_INTERVAL_SECONDS)

        if not _connected_clients:
            continue

        stats = await _fetch_stats()
        message = json.dumps({"type": "ledger_update", "data": stats})

        dead_clients: list[WebSocket] = []
        for ws in list(_connected_clients):
            try:
                await ws.send_text(message)
            except Exception:
                dead_clients.append(ws)

        for ws in dead_clients:
            if ws in _connected_clients:
                _connected_clients.remove(ws)
                logger.info("Removed dead WebSocket client. Remaining: %d", len(_connected_clients))


async def broadcast_anomaly(anomaly: dict[str, Any]):
    """
    Broadcast a single new anomaly event to all connected clients immediately.
    Called by main.py after detection runs.
    """
    if not _connected_clients:
        return
    message = json.dumps({"type": "new_anomaly", "data": anomaly})
    dead_clients: list[WebSocket] = []
    for ws in list(_connected_clients):
        try:
            await ws.send_text(message)
        except Exception:
            dead_clients.append(ws)
    for ws in dead_clients:
        if ws in _connected_clients:
            _connected_clients.remove(ws)
