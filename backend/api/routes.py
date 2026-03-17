"""
FastAPI REST routes for the XRPL Anomaly Detection API.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _row_to_dict(row, keys: list[str]) -> dict:
    return {k: v for k, v in zip(keys, row)}


# ---------------------------------------------------------------------------
# GET /anomalies
# ---------------------------------------------------------------------------

@router.get("/anomalies")
async def get_anomalies(
    type: Optional[str] = Query(None, description="Filter by anomaly_type"),
    asset_pair: Optional[str] = Query(None),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Return paginated anomaly flags with optional filters."""
    filters = []
    params: dict = {}

    if type:
        filters.append("anomaly_type = :type")
        params["type"] = type
    if asset_pair:
        filters.append("asset_pair = :asset_pair")
        params["asset_pair"] = asset_pair
    if min_confidence is not None:
        filters.append("confidence_score >= :min_conf")
        params["min_conf"] = min_confidence

    where_clause = ("WHERE " + " AND ".join(filters)) if filters else ""

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM anomaly_flags {where_clause}"), params
    )
    total = count_result.scalar() or 0

    params["limit"] = limit
    params["offset"] = offset
    result = await db.execute(
        text(
            f"""
            SELECT id, anomaly_type, ledger_index, attacker_address, victim_address,
                   asset_pair, profit_xrp, confidence_score, tx_hashes, timestamp, detail_json
            FROM anomaly_flags
            {where_clause}
            ORDER BY confidence_score DESC, id DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        params,
    )
    keys = [
        "id", "anomaly_type", "ledger_index", "attacker_address", "victim_address",
        "asset_pair", "profit_xrp", "confidence_score", "tx_hashes", "timestamp", "detail_json",
    ]
    items = [_row_to_dict(row, keys) for row in result.fetchall()]
    return {"total": total, "items": items}


# ---------------------------------------------------------------------------
# GET /metrics/volume
# ---------------------------------------------------------------------------

WINDOW_SECONDS = {
    "1h": 3600,
    "6h": 21600,
    "24h": 86400,
    "7d": 604800,
}


@router.get("/metrics/volume")
async def get_volume_metrics(
    window: str = Query("24h", regex="^(1h|6h|24h|7d)$"),
    db: AsyncSession = Depends(get_db),
):
    """Return volume buckets and summary statistics for the given time window."""
    # We don't have a wide datetime range; use all data and bucket by ledger
    result = await db.execute(
        text(
            """
            SELECT t.ledger_index,
                   t.timestamp,
                   t.amount_drops,
                   t.tx_type,
                   t.asset_pair
            FROM transactions t
            ORDER BY t.ledger_index
            """
        )
    )
    rows = result.fetchall()

    # Anomaly ledger indices
    anom_result = await db.execute(text("SELECT ledger_index FROM anomaly_flags WHERE ledger_index IS NOT NULL"))
    anomaly_ledgers = {r[0] for r in anom_result.fetchall()}

    # Group by hour bucket (using timestamp string)
    buckets: dict[str, dict] = {}
    raw_total = 0.0
    dust_count = 0
    total_count = 0

    payment_count = 0
    for lidx, ts, amt, tx_type, asset_pair in rows:
        hour_key = (str(ts or "")[:13] or "unknown")  # e.g. "2026-03-11T15"
        if hour_key not in buckets:
            buckets[hour_key] = {
                "timestamp": hour_key,
                "raw_volume": 0.0,
                "tx_count": 0,
                "anomaly_count": 0,
            }
        b = buckets[hour_key]
        # Only sum XRP-denominated amounts (drops ≤ 1e13); skip token values and nulls
        is_xrp_payment = (tx_type == "Payment" and amt is not None and float(amt) <= 1e13)
        amt_f = float(amt) if is_xrp_payment else 0.0
        b["raw_volume"] += amt_f
        b["tx_count"] += 1
        if lidx in anomaly_ledgers:
            b["anomaly_count"] += 1
        raw_total += amt_f
        total_count += 1
        # Dust: only meaningful for payments that actually transfer XRP
        if tx_type == "Payment" and amt is not None:
            payment_count += 1
            if float(amt) < 1000:
                dust_count += 1

    # Wash trade ratio: fraction of transactions sent by flagged wash-trade accounts
    wt_accounts_result = await db.execute(
        text("SELECT DISTINCT attacker_address FROM anomaly_flags WHERE anomaly_type='wash_trade'")
    )
    wt_accounts = {r[0] for r in wt_accounts_result.fetchall()}

    wt_tx_result = await db.execute(
        text("SELECT COUNT(*) FROM transactions WHERE account = ANY(:addrs)")
        if False else  # SQLite doesn't support ANY(); use IN with subquery
        text("SELECT COUNT(*) FROM transactions WHERE account IN (SELECT DISTINCT attacker_address FROM anomaly_flags WHERE anomaly_type='wash_trade')")
    )
    wash_tx_count = wt_tx_result.scalar() or 0

    sw_result = await db.execute(
        text("SELECT COUNT(*) FROM anomaly_flags WHERE anomaly_type='sandwich'")
    )
    sandwich_count = sw_result.scalar() or 0

    # Dust ratio: only over Payment transactions (not OfferCreate, NFToken, etc.)
    dust_ratio = dust_count / max(payment_count, 1)
    # Wash trade ratio: fraction of all transactions from wash-trade-flagged accounts
    wash_ratio = wash_tx_count / max(total_count, 1)

    sorted_buckets = sorted(buckets.values(), key=lambda x: x["timestamp"])

    return {
        "buckets": sorted_buckets,
        "summary": {
            "raw_total": raw_total,
            "wash_trade_ratio": round(wash_ratio, 6),
            "dust_ratio": round(dust_ratio, 6),
            "sandwich_count": sandwich_count,
        },
    }


# ---------------------------------------------------------------------------
# GET /metrics/orderbook
# ---------------------------------------------------------------------------

@router.get("/metrics/orderbook")
async def get_orderbook_metrics(
    asset_pair: str = Query("XRP/RLUSD"),
    db: AsyncSession = Depends(get_db),
):
    """Return per-ledger order book snapshots for a given asset pair."""
    result = await db.execute(
        text(
            """
            SELECT t.ledger_index,
                   MIN(t.timestamp) AS ts,
                   COUNT(*) AS tx_count,
                   COALESCE(SUM(t.amount_drops), 0) AS total_volume
            FROM transactions t
            WHERE t.asset_pair = :pair
               OR t.asset_pair LIKE :pair_like
            GROUP BY t.ledger_index
            ORDER BY t.ledger_index
            LIMIT 200
            """
        ),
        {"pair": asset_pair, "pair_like": f"%{asset_pair.split('/')[0]}%"},
    )
    rows = result.fetchall()
    snapshots = [
        {
            "ledger_index": r[0],
            "timestamp": r[1],
            "tx_count": r[2],
            "total_volume": r[3],
        }
        for r in rows
    ]
    return {"snapshots": snapshots}


# ---------------------------------------------------------------------------
# GET /address/{address}
# ---------------------------------------------------------------------------

@router.get("/address/{address}")
async def get_address(address: str, db: AsyncSession = Depends(get_db)):
    """Return metrics, anomalies, and recent transactions for an address."""
    # Metrics
    m_result = await db.execute(
        text(
            "SELECT address, daily_tx_count, offer_cancel_rate, ngfr, rtr, "
            "       isolation_score, intra_cluster_ratio, last_updated "
            "FROM address_metrics WHERE address = :addr"
        ),
        {"addr": address},
    )
    m_row = m_result.fetchone()
    metrics = (
        {
            "address": m_row[0],
            "daily_tx_count": m_row[1],
            "offer_cancel_rate": m_row[2],
            "ngfr": m_row[3],
            "rtr": m_row[4],
            "isolation_score": m_row[5],
            "intra_cluster_ratio": m_row[6],
            "last_updated": m_row[7],
        }
        if m_row
        else {}
    )

    # Anomalies
    a_result = await db.execute(
        text(
            "SELECT id, anomaly_type, ledger_index, attacker_address, victim_address, "
            "       asset_pair, profit_xrp, confidence_score, tx_hashes, timestamp, detail_json "
            "FROM anomaly_flags WHERE attacker_address = :addr OR victim_address = :addr "
            "ORDER BY confidence_score DESC LIMIT 50"
        ),
        {"addr": address},
    )
    akeys = [
        "id", "anomaly_type", "ledger_index", "attacker_address", "victim_address",
        "asset_pair", "profit_xrp", "confidence_score", "tx_hashes", "timestamp", "detail_json",
    ]
    anomalies = [_row_to_dict(r, akeys) for r in a_result.fetchall()]

    # Last 50 transactions
    t_result = await db.execute(
        text(
            "SELECT hash, ledger_index, account, tx_type, destination, "
            "       amount_drops, fee_drops, exec_price, timestamp, asset_pair, canonical_position "
            "FROM transactions WHERE account = :addr "
            "ORDER BY ledger_index DESC, canonical_position DESC LIMIT 50"
        ),
        {"addr": address},
    )
    tkeys = [
        "hash", "ledger_index", "account", "tx_type", "destination",
        "amount_drops", "fee_drops", "exec_price", "timestamp", "asset_pair", "canonical_position",
    ]
    transactions = [_row_to_dict(r, tkeys) for r in t_result.fetchall()]

    return {"address": address, "metrics": metrics, "anomalies": anomalies, "transactions": transactions}


# ---------------------------------------------------------------------------
# GET /ledger/{index}/transactions
# ---------------------------------------------------------------------------

@router.get("/ledger/{index}/transactions")
async def get_ledger_transactions(index: int, db: AsyncSession = Depends(get_db)):
    """Return all transactions and anomalies for a specific ledger index."""
    t_result = await db.execute(
        text(
            "SELECT hash, ledger_index, account, tx_type, destination, "
            "       amount_drops, fee_drops, exec_price, timestamp, asset_pair, canonical_position "
            "FROM transactions WHERE ledger_index = :idx ORDER BY canonical_position"
        ),
        {"idx": index},
    )
    tkeys = [
        "hash", "ledger_index", "account", "tx_type", "destination",
        "amount_drops", "fee_drops", "exec_price", "timestamp", "asset_pair", "canonical_position",
    ]
    transactions = [_row_to_dict(r, tkeys) for r in t_result.fetchall()]

    a_result = await db.execute(
        text(
            "SELECT id, anomaly_type, ledger_index, attacker_address, victim_address, "
            "       asset_pair, profit_xrp, confidence_score, tx_hashes, timestamp, detail_json "
            "FROM anomaly_flags WHERE ledger_index = :idx"
        ),
        {"idx": index},
    )
    akeys = [
        "id", "anomaly_type", "ledger_index", "attacker_address", "victim_address",
        "asset_pair", "profit_xrp", "confidence_score", "tx_hashes", "timestamp", "detail_json",
    ]
    anomalies = [_row_to_dict(r, akeys) for r in a_result.fetchall()]

    return {"ledger_index": index, "transactions": transactions, "anomalies_in_ledger": anomalies}


# ---------------------------------------------------------------------------
# GET /stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Return overall system statistics."""
    tx_count = (await db.execute(text("SELECT COUNT(*) FROM transactions"))).scalar() or 0
    ledger_count = (await db.execute(text("SELECT COUNT(*) FROM ledger_closes"))).scalar() or 0

    anom_result = await db.execute(
        text(
            "SELECT anomaly_type, COUNT(*) AS cnt FROM anomaly_flags GROUP BY anomaly_type"
        )
    )
    anomaly_count_by_type = {row[0]: row[1] for row in anom_result.fetchall()}

    top_result = await db.execute(
        text(
            """
            SELECT attacker_address, COUNT(*) AS cnt
            FROM anomaly_flags
            WHERE attacker_address IS NOT NULL
            GROUP BY attacker_address
            ORDER BY cnt DESC
            LIMIT 10
            """
        )
    )
    top_anomalous = [{"address": r[0], "anomaly_count": r[1]} for r in top_result.fetchall()]

    range_result = await db.execute(
        text("SELECT MIN(ledger_index), MAX(ledger_index) FROM ledger_closes")
    )
    ledger_range_row = range_result.fetchone()
    ledger_range = {
        "min": ledger_range_row[0] if ledger_range_row else None,
        "max": ledger_range_row[1] if ledger_range_row else None,
    }

    time_result = await db.execute(
        text("SELECT MIN(close_time), MAX(close_time) FROM ledger_closes")
    )
    time_row = time_result.fetchone()
    time_range = {
        "start": time_row[0] if time_row else None,
        "end": time_row[1] if time_row else None,
    }

    return {
        "total_transactions": tx_count,
        "total_ledgers": ledger_count,
        "anomaly_count_by_type": anomaly_count_by_type,
        "top_anomalous_addresses": top_anomalous,
        "ledger_range": ledger_range,
        "time_range": time_range,
    }


# ---------------------------------------------------------------------------
# GET /heatmap
# ---------------------------------------------------------------------------

@router.get("/heatmap")
async def get_heatmap(
    metric: str = Query("tx_count", regex="^(tx_count|anomaly_count|volume)$"),
    db: AsyncSession = Depends(get_db),
):
    """Return hour×day_of_week heatmap cells computed from real timestamps."""
    if metric == "anomaly_count":
        result = await db.execute(
            text(
                "SELECT timestamp FROM anomaly_flags WHERE timestamp IS NOT NULL"
            )
        )
        timestamps = [r[0] for r in result.fetchall()]
    elif metric == "volume":
        result = await db.execute(
            text(
                "SELECT timestamp, amount_drops FROM transactions WHERE timestamp IS NOT NULL"
            )
        )
        raw = result.fetchall()
        timestamps = None  # handled separately below
        rows_for_volume = raw
    else:
        result = await db.execute(
            text("SELECT timestamp FROM transactions WHERE timestamp IS NOT NULL")
        )
        timestamps = [r[0] for r in result.fetchall()]

    # Build heatmap grid
    from datetime import datetime, timezone

    def _parse(ts_str: str):
        for fmt in ("%Y-%m-%dT%H:%M:%S+00:00", "%Y-%m-%dT%H:%M:%SZ"):
            try:
                return datetime.strptime(ts_str, fmt).replace(tzinfo=timezone.utc)
            except Exception:
                pass
        try:
            return datetime.fromisoformat(ts_str)
        except Exception:
            return None

    cells: dict[tuple[int, int], float] = {}

    if metric == "volume":
        for ts_str, amt in rows_for_volume:
            dt = _parse(str(ts_str))
            if dt is None:
                continue
            key = (dt.hour, dt.weekday())
            cells[key] = cells.get(key, 0.0) + float(amt or 0)
    else:
        for ts_str in timestamps:
            dt = _parse(str(ts_str))
            if dt is None:
                continue
            key = (dt.hour, dt.weekday())
            cells[key] = cells.get(key, 0.0) + 1.0

    output = [
        {"hour": h, "day_of_week": d, "value": v}
        for (h, d), v in cells.items()
    ]
    return {"cells": output}


# ---------------------------------------------------------------------------
# GET /top-accounts
# ---------------------------------------------------------------------------

@router.get("/top-accounts")
async def get_top_accounts(db: AsyncSession = Depends(get_db)):
    """Return top accounts ranked by transaction count with anomaly info."""
    result = await db.execute(
        text(
            """
            SELECT t.account,
                   COUNT(*) AS tx_count,
                   COALESCE(a.anomaly_count, 0) AS anomaly_count,
                   COALESCE(m.isolation_score, 0.0) AS isolation_score
            FROM transactions t
            LEFT JOIN (
                SELECT attacker_address AS address, COUNT(*) AS anomaly_count
                FROM anomaly_flags
                WHERE attacker_address IS NOT NULL
                GROUP BY attacker_address
            ) a ON t.account = a.address
            LEFT JOIN address_metrics m ON t.account = m.address
            WHERE t.account IS NOT NULL
            GROUP BY t.account
            ORDER BY tx_count DESC
            LIMIT 50
            """
        )
    )
    accounts = [
        {
            "address": r[0],
            "tx_count": r[1],
            "anomaly_count": r[2],
            "isolation_score": r[3],
        }
        for r in result.fetchall()
    ]
    return {"accounts": accounts}


# ---------------------------------------------------------------------------
# GET /transactions/recent
# ---------------------------------------------------------------------------

@router.get("/transactions/recent")
async def get_recent_transactions(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent transactions with real amounts for the live feed."""
    result = await db.execute(
        text(
            """
            SELECT t.hash, t.ledger_index, t.account, t.tx_type,
                   t.destination, t.amount_drops, t.fee_drops,
                   t.timestamp, t.asset_pair,
                   CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END AS is_anomaly,
                   COALESCE(a.anomaly_type, '') AS anomaly_type,
                   COALESCE(a.confidence_score, 0.0) AS anomaly_score
            FROM transactions t
            LEFT JOIN anomaly_flags a
              ON a.attacker_address = t.account
             AND a.ledger_index = t.ledger_index
            ORDER BY t.ledger_index DESC, t.canonical_position DESC
            LIMIT :limit
            """
        ),
        {"limit": limit},
    )
    rows = result.fetchall()
    keys = ["hash", "ledger_index", "account", "tx_type", "destination",
            "amount_drops", "fee_drops", "timestamp", "asset_pair",
            "is_anomaly", "anomaly_type", "anomaly_score"]
    return {"transactions": [dict(zip(keys, r)) for r in rows]}


# ---------------------------------------------------------------------------
# GET /analytics/tx-types  — real transaction type distribution
# ---------------------------------------------------------------------------

@router.get("/analytics/tx-types")
async def get_tx_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text(
        """
        SELECT tx_type, COUNT(*) AS cnt
        FROM transactions
        WHERE tx_type IS NOT NULL
        GROUP BY tx_type
        ORDER BY cnt DESC
        """
    ))
    rows = result.fetchall()
    total = sum(r[1] for r in rows)
    return {
        "types": [
            {"tx_type": r[0], "count": r[1],
             "percentage": round(r[1] / total * 100, 2) if total else 0}
            for r in rows
        ],
        "total": total,
    }


# ---------------------------------------------------------------------------
# GET /analytics/wallet-pairs  — top wallet pairs by transaction count
# ---------------------------------------------------------------------------

@router.get("/analytics/wallet-pairs")
async def get_wallet_pairs(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text(
        """
        SELECT account, destination, COUNT(*) AS tx_count,
               SUM(CASE WHEN amount_drops <= 1e13 THEN amount_drops / 1000000.0 ELSE 0 END) AS volume_xrp
        FROM transactions
        WHERE destination IS NOT NULL AND account IS NOT NULL
        GROUP BY account, destination
        ORDER BY tx_count DESC
        LIMIT :limit
        """
    ), {"limit": limit})
    rows = result.fetchall()
    return {
        "pairs": [
            {"from_account": r[0], "to_account": r[1],
             "tx_count": r[2], "volume_xrp": round(r[3] or 0, 4)}
            for r in rows
        ]
    }


# ---------------------------------------------------------------------------
# GET /analytics/volume-series  — per-minute volume with Bollinger bands
# ---------------------------------------------------------------------------

@router.get("/analytics/volume-series")
async def get_volume_series(db: AsyncSession = Depends(get_db)):
    """Return per-minute XRP volume with 10-period Bollinger bands."""
    result = await db.execute(text(
        """
        SELECT strftime('%Y-%m-%dT%H:%M', timestamp) AS minute,
               SUM(CASE WHEN amount_drops IS NOT NULL AND amount_drops <= 1e13
                        THEN amount_drops / 1000000.0 ELSE 0 END) AS volume_xrp,
               COUNT(*) AS tx_count
        FROM transactions
        WHERE timestamp IS NOT NULL
        GROUP BY minute
        ORDER BY minute
        """
    ))
    rows = result.fetchall()
    if not rows:
        return {"points": []}

    volumes = [float(r[1]) for r in rows]
    window = 10
    points = []
    for i, row in enumerate(rows):
        vol = volumes[i]
        if i < window:
            sma = sum(volumes[:i+1]) / (i+1)
            std = 0.0
        else:
            sl = volumes[i-window:i]
            sma = sum(sl) / window
            variance = sum((x - sma)**2 for x in sl) / window
            std = variance**0.5
        upper = sma + 2 * std
        lower = max(0, sma - 2 * std)
        points.append({
            "time": row[0][-5:],  # HH:MM
            "volume": round(vol, 4),
            "sma": round(sma, 4),
            "upper": round(upper, 4),
            "lower": round(lower, 4),
            "tx_count": row[2],
            "is_spike": vol > upper and std > 0,
        })
    return {"points": points}


# ---------------------------------------------------------------------------
# Extend /stats with avg_fee
# ---------------------------------------------------------------------------

@router.get("/anomalies/distribution")
async def get_anomaly_distribution(db: AsyncSession = Depends(get_db)):
    """Return confidence score distribution across ALL anomaly_flags rows."""
    result = await db.execute(text(
        """
        SELECT confidence_score, anomaly_type, COUNT(*) as cnt
        FROM anomaly_flags
        GROUP BY confidence_score, anomaly_type
        ORDER BY confidence_score
        """
    ))
    rows = result.fetchall()
    buckets = [{"score": round(i * 0.1, 1), "count": 0} for i in range(11)]
    by_score = {}
    for score, atype, cnt in rows:
        idx = min(9, int(round(float(score or 0) * 10)))
        buckets[idx]["count"] += cnt
        key = f"{score:.4f}"
        if key not in by_score:
            by_score[key] = {"score": float(score or 0), "total": 0, "by_type": {}}
        by_score[key]["total"] += cnt
        by_score[key]["by_type"][atype] = cnt
    return {
        "buckets": buckets[:10],
        "by_score": sorted(by_score.values(), key=lambda x: x["score"]),
        "total": sum(r[2] for r in rows),
    }


@router.get("/analytics/fee-stats")
async def get_fee_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text(
        """
        SELECT AVG(fee_drops), MIN(fee_drops), MAX(fee_drops),
               AVG(fee_drops) / 1000000.0
        FROM transactions WHERE fee_drops IS NOT NULL AND fee_drops > 0
        """
    ))
    row = result.fetchone()
    return {
        "avg_fee_drops": round(row[0] or 0, 2),
        "min_fee_drops": row[1],
        "max_fee_drops": row[2],
        "avg_fee_xrp": round(row[3] or 0, 8),
    }
