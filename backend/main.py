"""
XRPL Anomaly Detection API — entry point.

Start with:
    cd backend && python main.py

Or directly with uvicorn:
    cd backend && uvicorn main:app --host 0.0.0.0 --port 8000
"""

import asyncio
import json
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, AsyncSessionLocal
from ingestion.loader import seed_database
from detection.sandwich import detect_sandwich_attacks
from detection.wash_trade import detect_wash_trades, compute_address_metrics
from detection.pathfinder import detect_pathfinder_inflation
from detection.isolation_forest import run_isolation_forest
from api.routes import router
from api.websocket import router as ws_router, start_broadcast_loop

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="XRPL Anomaly Detection API",
    description="Real-time anomaly detection for XRPL transactions: sandwich attacks, wash trading, and pathfinder price inflation.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(ws_router)


# ---------------------------------------------------------------------------
# Detection pipeline
# ---------------------------------------------------------------------------

async def run_all_detection(session) -> None:
    """
    Run all three detectors, persist results, compute address metrics,
    run Isolation Forest and update address_metrics table.
    """
    from sqlalchemy import text

    # -----------------------------------------------------------------------
    # Clear old anomaly flags before re-detection
    # -----------------------------------------------------------------------
    logger.info("Clearing old anomaly flags...")
    try:
        await session.execute(text("DELETE FROM anomaly_flags"))
        await session.commit()
    except Exception as exc:
        logger.error("Failed to clear anomaly_flags: %s", exc)

    # -----------------------------------------------------------------------
    # 1. Sandwich attack detection
    # -----------------------------------------------------------------------
    logger.info("Running sandwich attack detection...")
    sandwich_anomalies = []
    try:
        sandwich_anomalies = await detect_sandwich_attacks(session)
        if sandwich_anomalies:
            await session.execute(
                text(
                    "INSERT INTO anomaly_flags "
                    "(anomaly_type, ledger_index, attacker_address, victim_address, "
                    " asset_pair, profit_xrp, confidence_score, tx_hashes, timestamp, detail_json) "
                    "VALUES (:anomaly_type, :ledger_index, :attacker_address, :victim_address, "
                    " :asset_pair, :profit_xrp, :confidence_score, :tx_hashes, :timestamp, :detail_json)"
                ),
                sandwich_anomalies,
            )
            await session.commit()
            logger.info("Inserted %d sandwich anomalies.", len(sandwich_anomalies))
    except Exception as exc:
        logger.error("Sandwich detection failed: %s", exc, exc_info=True)
        await session.rollback()

    # -----------------------------------------------------------------------
    # 2. Wash trade detection
    # -----------------------------------------------------------------------
    logger.info("Running wash trade detection...")
    wash_anomalies = []
    try:
        wash_anomalies = await detect_wash_trades(session)
        if wash_anomalies:
            await session.execute(
                text(
                    "INSERT INTO anomaly_flags "
                    "(anomaly_type, ledger_index, attacker_address, victim_address, "
                    " asset_pair, profit_xrp, confidence_score, tx_hashes, timestamp, detail_json) "
                    "VALUES (:anomaly_type, :ledger_index, :attacker_address, :victim_address, "
                    " :asset_pair, :profit_xrp, :confidence_score, :tx_hashes, :timestamp, :detail_json)"
                ),
                wash_anomalies,
            )
            await session.commit()
            logger.info("Inserted %d wash trade anomalies.", len(wash_anomalies))
    except Exception as exc:
        logger.error("Wash trade detection failed: %s", exc, exc_info=True)
        await session.rollback()

    # -----------------------------------------------------------------------
    # 3. Pathfinder inflation detection
    # -----------------------------------------------------------------------
    logger.info("Running pathfinder inflation detection...")
    pathfinder_anomalies = []
    try:
        pathfinder_anomalies = await detect_pathfinder_inflation(session)
        if pathfinder_anomalies:
            await session.execute(
                text(
                    "INSERT INTO anomaly_flags "
                    "(anomaly_type, ledger_index, attacker_address, victim_address, "
                    " asset_pair, profit_xrp, confidence_score, tx_hashes, timestamp, detail_json) "
                    "VALUES (:anomaly_type, :ledger_index, :attacker_address, :victim_address, "
                    " :asset_pair, :profit_xrp, :confidence_score, :tx_hashes, :timestamp, :detail_json)"
                ),
                pathfinder_anomalies,
            )
            await session.commit()
            logger.info("Inserted %d pathfinder anomalies.", len(pathfinder_anomalies))
    except Exception as exc:
        logger.error("Pathfinder detection failed: %s", exc, exc_info=True)
        await session.rollback()

    # -----------------------------------------------------------------------
    # 4. Compute address metrics
    # -----------------------------------------------------------------------
    logger.info("Computing address metrics...")
    address_metrics = []
    try:
        address_metrics = await compute_address_metrics(session)
        if address_metrics:
            # Upsert (INSERT OR REPLACE) address metrics
            await session.execute(
                text(
                    "INSERT OR REPLACE INTO address_metrics "
                    "(address, daily_tx_count, offer_cancel_rate, ngfr, rtr, "
                    " isolation_score, intra_cluster_ratio, last_updated) "
                    "VALUES (:address, :daily_tx_count, :offer_cancel_rate, :ngfr, :rtr, "
                    " 0.0, :intra_cluster_ratio, :last_updated)"
                ),
                address_metrics,
            )
            await session.commit()
            logger.info("Inserted/updated %d address metric rows.", len(address_metrics))
    except Exception as exc:
        logger.error("Address metrics computation failed: %s", exc, exc_info=True)
        await session.rollback()

    # -----------------------------------------------------------------------
    # 5. Isolation Forest — update isolation_score in address_metrics
    # -----------------------------------------------------------------------
    logger.info("Running Isolation Forest...")
    try:
        scores = await run_isolation_forest(session)
        if scores:
            score_rows = [{"address": addr, "score": score} for addr, score in scores.items()]
            await session.execute(
                text(
                    "UPDATE address_metrics SET isolation_score = :score "
                    "WHERE address = :address"
                ),
                score_rows,
            )
            await session.commit()
            logger.info("Updated isolation scores for %d addresses.", len(scores))
    except Exception as exc:
        logger.error("Isolation Forest failed: %s", exc, exc_info=True)
        await session.rollback()

    total_anomalies = len(sandwich_anomalies) + len(wash_anomalies) + len(pathfinder_anomalies)
    logger.info(
        "Detection pipeline complete. Total anomalies: %d "
        "(sandwich=%d, wash_trade=%d, pathfinder=%d)",
        total_anomalies,
        len(sandwich_anomalies),
        len(wash_anomalies),
        len(pathfinder_anomalies),
    )


# ---------------------------------------------------------------------------
# Startup event
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup():
    logger.info("=== XRPL Anomaly Detection API starting up ===")

    # Initialise DB schema
    await init_db()

    # Seed from CSVs and run detection in a dedicated session
    async with AsyncSessionLocal() as session:
        await seed_database(session)
        await run_all_detection(session)

    # Start WebSocket broadcast background task
    asyncio.create_task(start_broadcast_loop())

    logger.info("=== Startup complete. API is ready. ===")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
