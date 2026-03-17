"""
Pathfinder price inflation detection.

Two signals:
  1. High implied slippage on Payment transactions:
       slippage_bps = fee / amount_drops * 10000
     Flag asset_pairs where rolling mean slippage > 150 bps.

  2. High offer-cancellation rate (OCR) per address:
       OCR = OfferCancel / (OfferCreate + OfferCancel)
     Flag addresses with OCR > 0.80 AND total offers > 50.
"""

import json
import logging
from typing import Any

import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

SLIPPAGE_THRESHOLD_BPS = 150.0
OCR_THRESHOLD = 0.80
MIN_TOTAL_OFFERS = 50


async def detect_pathfinder_inflation(db_session: AsyncSession) -> list[dict[str, Any]]:
    """
    Detect pathfinder price inflation anomalies.
    Returns list of anomaly dicts for insertion into anomaly_flags.
    """
    try:
        result = await db_session.execute(
            text(
                """
                SELECT hash, account, tx_type, amount_drops, fee_drops,
                       asset_pair, ledger_index, timestamp
                FROM transactions
                WHERE tx_type IN ('Payment', 'OfferCreate', 'OfferCancel')
                """
            )
        )
        rows = result.fetchall()
    except Exception as exc:
        logger.error("Error fetching transactions for pathfinder detection: %s", exc)
        return []

    if not rows:
        logger.info("No rows available for pathfinder detection.")
        return []

    df = pd.DataFrame(
        rows,
        columns=["hash", "account", "tx_type", "amount_drops", "fee_drops", "asset_pair", "ledger_index", "timestamp"],
    )
    df["amount_drops"] = pd.to_numeric(df["amount_drops"], errors="coerce")
    df["fee_drops"] = pd.to_numeric(df["fee_drops"], errors="coerce")

    anomalies: list[dict[str, Any]] = []

    # ------------------------------------------------------------------ #
    # Signal 1: Payment slippage per asset_pair                          #
    # ------------------------------------------------------------------ #
    payments = df[(df["tx_type"] == "Payment") & (df["amount_drops"] > 0) & (df["fee_drops"].notna())].copy()

    if not payments.empty:
        payments["slippage_bps"] = payments["fee_drops"] / payments["amount_drops"] * 10_000
        # Group by asset_pair, compute mean slippage
        pair_slippage = payments.groupby("asset_pair")["slippage_bps"].mean()

        for asset_pair, mean_slippage in pair_slippage.items():
            if pd.isna(mean_slippage) or mean_slippage <= SLIPPAGE_THRESHOLD_BPS:
                continue

            # Representative transactions (top 5 by slippage)
            pair_txs = payments[payments["asset_pair"] == asset_pair].nlargest(5, "slippage_bps")
            tx_hashes = pair_txs["hash"].dropna().tolist()

            # Attacker = account with most payments on this pair
            top_account = (
                payments[payments["asset_pair"] == asset_pair]["account"]
                .value_counts()
                .index[0]
                if not payments[payments["asset_pair"] == asset_pair].empty
                else None
            )

            ledger_idx = pair_txs["ledger_index"].dropna().min()
            ts = pair_txs["timestamp"].dropna().iloc[0] if not pair_txs.empty else None

            detail = {
                "description": (
                    f"Asset pair {asset_pair} has mean Payment slippage "
                    f"{mean_slippage:.1f} bps (threshold: {SLIPPAGE_THRESHOLD_BPS} bps). "
                    f"This may indicate pathfinder price inflation."
                ),
                "mean_slippage_bps": round(float(mean_slippage), 2),
                "payment_count": int(len(payments[payments["asset_pair"] == asset_pair])),
            }

            anomalies.append(
                {
                    "anomaly_type": "pathfinder_inflation",
                    "ledger_index": int(ledger_idx) if pd.notna(ledger_idx) else None,
                    "attacker_address": top_account,
                    "victim_address": None,
                    "asset_pair": str(asset_pair) if pd.notna(asset_pair) else None,
                    "profit_xrp": 0.0,
                    "confidence_score": round(
                        min(1.0, (mean_slippage - SLIPPAGE_THRESHOLD_BPS) / SLIPPAGE_THRESHOLD_BPS * 0.5 + 0.5), 4
                    ),
                    "tx_hashes": json.dumps(tx_hashes),
                    "timestamp": str(ts) if ts is not None else None,
                    "detail_json": json.dumps(detail),
                }
            )

    # ------------------------------------------------------------------ #
    # Signal 2: High offer-cancellation rate per address                 #
    # ------------------------------------------------------------------ #
    offers_df = df[df["tx_type"].isin(["OfferCreate", "OfferCancel"])].copy()

    if not offers_df.empty:
        create_counts = offers_df[offers_df["tx_type"] == "OfferCreate"].groupby("account").size()
        cancel_counts = offers_df[offers_df["tx_type"] == "OfferCancel"].groupby("account").size()

        total_offers = create_counts.add(cancel_counts, fill_value=0)
        ocr = cancel_counts.div(total_offers.replace(0, float("nan"))).fillna(0)

        flagged = ocr[(ocr > OCR_THRESHOLD) & (total_offers > MIN_TOTAL_OFFERS)]

        for account, rate in flagged.items():
            # Get a representative ledger and timestamp
            acct_rows = offers_df[offers_df["account"] == account]
            ledger_idx = acct_rows["ledger_index"].dropna().min()
            ts = acct_rows["timestamp"].dropna().iloc[0] if not acct_rows.empty else None
            asset_pair = acct_rows["asset_pair"].dropna().mode()
            asset_pair_str = str(asset_pair.iloc[0]) if not asset_pair.empty else None
            tx_hashes = acct_rows["hash"].dropna().head(5).tolist()
            total_count = int(total_offers.get(account, 0))

            detail = {
                "description": (
                    f"Address {account} has offer cancellation rate {rate:.3f} "
                    f"({total_count} total offers). "
                    f"OCR > {OCR_THRESHOLD} with >{MIN_TOTAL_OFFERS} offers indicates "
                    f"potential layering / pathfinder manipulation."
                ),
                "ocr": round(float(rate), 4),
                "total_offers": total_count,
                "cancel_count": int(cancel_counts.get(account, 0)),
                "create_count": int(create_counts.get(account, 0)),
            }

            anomalies.append(
                {
                    "anomaly_type": "pathfinder_inflation",
                    "ledger_index": int(ledger_idx) if pd.notna(ledger_idx) else None,
                    "attacker_address": str(account),
                    "victim_address": None,
                    "asset_pair": asset_pair_str,
                    "profit_xrp": 0.0,
                    "confidence_score": round(
                        min(1.0, (float(rate) - OCR_THRESHOLD) / (1.0 - OCR_THRESHOLD) * 0.5 + 0.5), 4
                    ),
                    "tx_hashes": json.dumps(tx_hashes),
                    "timestamp": str(ts) if ts is not None else None,
                    "detail_json": json.dumps(detail),
                }
            )

    logger.info("Pathfinder detection found %d anomalies.", len(anomalies))
    return anomalies
