"""
Isolation Forest anomaly detection on address-level features.

Features per address:
  [daily_tx_count, offer_cancel_rate, ngfr, rtr, intra_cluster_ratio]

Raw IF score is in [-0.5, 0.5]; convert to [0,1]:
  score = clamp(0.5 - raw_score, 0.0, 1.0)
  (higher = more anomalous)
"""

import logging
from typing import Any

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

FEATURES = ["daily_tx_count", "offer_cancel_rate", "ngfr", "rtr", "intra_cluster_ratio"]
IF_CONTAMINATION = 0.05
IF_N_ESTIMATORS = 100
IF_RANDOM_STATE = 42


def train_isolation_forest(address_metrics: list[dict[str, Any]]) -> dict[str, float]:
    """
    Train IsolationForest on address metrics and return {address: anomaly_score}.

    Args:
        address_metrics: list of dicts containing address + feature columns.

    Returns:
        dict mapping each address to a score in [0, 1].
        Higher scores indicate more anomalous behaviour.
    """
    if not address_metrics:
        logger.warning("No address metrics provided to IsolationForest — returning empty dict.")
        return {}

    addresses = [m["address"] for m in address_metrics]

    # Build feature matrix; fill missing values with column means / 0
    X_raw = []
    for m in address_metrics:
        row = [float(m.get(f) or 0.0) for f in FEATURES]
        X_raw.append(row)

    X = np.array(X_raw, dtype=float)

    # Replace NaN / inf
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    if X.shape[0] < 2:
        logger.warning("Insufficient samples (%d) for IsolationForest.", X.shape[0])
        return {addr: 0.0 for addr in addresses}

    # Normalise
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train
    clf = IsolationForest(
        n_estimators=IF_N_ESTIMATORS,
        contamination=IF_CONTAMINATION,
        random_state=IF_RANDOM_STATE,
    )
    clf.fit(X_scaled)

    # Raw scores: negative outlier factor; more negative = more anomalous.
    # decision_function returns values roughly in [-0.5, 0.5]:
    #   positive = inlier, negative = outlier.
    raw_scores = clf.decision_function(X_scaled)  # shape (n,)

    # Convert: anomaly_score = clamp(0.5 - raw_score, 0, 1)
    anomaly_scores = np.clip(0.5 - raw_scores, 0.0, 1.0)

    result = {addr: float(score) for addr, score in zip(addresses, anomaly_scores)}
    logger.info(
        "IsolationForest trained on %d addresses. Max score: %.4f, Mean: %.4f",
        len(addresses),
        float(anomaly_scores.max()) if len(anomaly_scores) else 0.0,
        float(anomaly_scores.mean()) if len(anomaly_scores) else 0.0,
    )
    return result


async def run_isolation_forest(db_session: AsyncSession) -> dict[str, float]:
    """
    Load address metrics from the DB, run IsolationForest, return score map.
    """
    try:
        result = await db_session.execute(
            text(
                """
                SELECT address, daily_tx_count, offer_cancel_rate,
                       ngfr, rtr, intra_cluster_ratio
                FROM address_metrics
                """
            )
        )
        rows = result.fetchall()
    except Exception as exc:
        logger.error("Error loading address metrics for IsolationForest: %s", exc)
        return {}

    if not rows:
        logger.info("No address metrics in DB — skipping IsolationForest.")
        return {}

    metrics = [
        {
            "address": row[0],
            "daily_tx_count": row[1],
            "offer_cancel_rate": row[2],
            "ngfr": row[3],
            "rtr": row[4],
            "intra_cluster_ratio": row[5],
        }
        for row in rows
    ]

    return train_isolation_forest(metrics)
