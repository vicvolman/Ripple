"""
Sandwich attack detection on XRPL OfferCreate transactions.

A genuine sandwich attack requires ALL of the following to produce a meaningful
confidence score:

  1. Attacker A places OfferCreate BEFORE victim B in the same ledger on the
     same asset_pair (canonical_position ordering).
  2. A reappears with another OfferCreate on the SAME asset_pair within 3
     subsequent ledger indices (the "exit" leg of the sandwich).
  3. B is a low-frequency trader on this pair — high-frequency accounts are
     market makers who understand execution risk, not victims.

Confidence scoring:
  +0.4  canonical_position ordering correct (A before B in same ledger+pair)
  +0.3  A reappears on the SAME asset_pair within ledger_gap <= 3
  +0.3  B trades this pair <= RETAIL_VICTIM_THRESHOLD times (retail-like)

Minimum confidence to flag: 0.7 (requires at least positions + same-pair exit).

Deduplication: one anomaly record per (attacker, asset_pair) — the highest-
confidence instance across all ledgers is kept, with an occurrence_count
field recording how many times the pattern was seen for that attacker+pair.
"""

import json
import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Accounts with more than this many OfferCreates on a pair are market makers —
# they are not credible victims of a sandwich attack.
MARKET_MAKER_THRESHOLD = 10

# Victim must trade the pair no more than this many times to be considered retail.
RETAIL_VICTIM_THRESHOLD = 5

# Attacker must have at least this many trades on the pair to be considered
# an active participant (filters out one-off coincidences).
MIN_ATTACKER_TRADES = 2

# Minimum confidence to emit an anomaly record.
MIN_CONFIDENCE = 0.7


async def detect_sandwich_attacks(db_session: AsyncSession) -> list[dict[str, Any]]:
    """
    Detect sandwich attack patterns from OfferCreate transactions in the DB.
    Returns a list of deduplicated anomaly dicts for insertion into anomaly_flags.
    """
    try:
        result = await db_session.execute(
            text(
                """
                SELECT hash, ledger_index, account, tx_type,
                       amount_drops, asset_pair, canonical_position, timestamp
                FROM transactions
                WHERE tx_type IN ('OfferCreate', 'OfferCancel')
                ORDER BY ledger_index, canonical_position
                """
            )
        )
        rows = result.fetchall()
    except Exception as exc:
        logger.error("Error fetching transactions for sandwich detection: %s", exc)
        return []

    if not rows:
        logger.info("No OfferCreate rows found — skipping sandwich detection.")
        return []

    # ------------------------------------------------------------------
    # 1. Precompute per-(account, asset_pair) trade counts.
    #    Used to identify market makers and retail victims.
    # ------------------------------------------------------------------
    pair_trade_counts: dict[tuple[str, str], int] = {}
    for row in rows:
        _, _, account, tx_type, _, asset_pair, _, _ = row
        if tx_type == "OfferCreate" and asset_pair:
            key = (account, asset_pair)
            pair_trade_counts[key] = pair_trade_counts.get(key, 0) + 1

    # ------------------------------------------------------------------
    # 2. Build lookup keyed by (ledger_index, account, asset_pair).
    #    This lets us check whether A reappears on the SAME pair, not
    #    just any pair, in subsequent ledgers.
    # ------------------------------------------------------------------
    account_pair_by_ledger: dict[tuple[int, str, str], list[tuple]] = {}
    ledger_map: dict[int, list[tuple]] = {}

    for row in rows:
        hash_, lidx, account, tx_type, amount_drops, asset_pair, canon_pos, ts = row
        if lidx is None or tx_type != "OfferCreate" or not asset_pair:
            continue
        lidx_int = int(lidx)
        tx = (hash_, account, tx_type, float(amount_drops or 0),
              asset_pair, int(canon_pos or 0), ts)

        # Per-(ledger, account, pair) lookup for the exit-leg check
        apbl_key = (lidx_int, account, asset_pair)
        account_pair_by_ledger.setdefault(apbl_key, []).append(tx)

        # Per-ledger list for the main pairing loop
        ledger_map.setdefault(lidx_int, []).append(tx)

    # ------------------------------------------------------------------
    # 3. Main detection loop.
    #    For each ledger, group OfferCreates by asset_pair, then look for
    #    (A before B, A exits on same pair within 3 ledgers) patterns.
    # ------------------------------------------------------------------

    # best_per_key: (attacker_account, asset_pair) → best anomaly dict so far
    best_per_key: dict[tuple[str, str], dict[str, Any]] = {}

    for ledger_idx in sorted(ledger_map.keys()):
        txs = ledger_map[ledger_idx]

        # Group by asset_pair
        pair_groups: dict[str, list[tuple]] = {}
        for tx in txs:
            pair = tx[4]
            if pair:
                pair_groups.setdefault(pair, []).append(tx)

        for asset_pair, pair_txs in pair_groups.items():
            if len(pair_txs) < 2:
                continue

            # Sort by canonical_position (transaction order within ledger)
            pair_txs.sort(key=lambda t: t[5])

            for i, tx_b in enumerate(pair_txs):
                b_hash, b_account, _, b_amount, _, b_pos, b_ts = tx_b

                # Skip market makers as victims — they understand execution risk
                b_trade_count = pair_trade_counts.get((b_account, asset_pair), 0)
                if b_trade_count > MARKET_MAKER_THRESHOLD:
                    continue

                for j in range(i):
                    tx_a = pair_txs[j]
                    a_hash, a_account, _, _, _, a_pos, a_ts = tx_a

                    if a_account == b_account:
                        continue

                    # Attacker must be an active participant on this pair
                    a_trade_count = pair_trade_counts.get((a_account, asset_pair), 0)
                    if a_trade_count < MIN_ATTACKER_TRADES:
                        continue

                    # Check if A reappears on the SAME asset_pair within 3 ledgers
                    a_reappears_same_pair = False
                    a_sell_hash = None
                    for gap in range(1, 4):
                        future_key = (ledger_idx + gap, a_account, asset_pair)
                        future_txs = account_pair_by_ledger.get(future_key, [])
                        if future_txs:
                            a_reappears_same_pair = True
                            a_sell_hash = future_txs[0][0]
                            break

                    # Confidence scoring
                    confidence = 0.0
                    if a_pos < b_pos:
                        confidence += 0.4
                    if a_reappears_same_pair:
                        confidence += 0.3
                    if b_trade_count <= RETAIL_VICTIM_THRESHOLD:
                        confidence += 0.3

                    if confidence < MIN_CONFIDENCE:
                        continue

                    tx_hashes = [a_hash, b_hash]
                    if a_sell_hash:
                        tx_hashes.append(a_sell_hash)

                    estimated_profit = 0.01 * b_amount if b_amount > 0 else 0.0

                    detail = {
                        "description": (
                            f"Sandwich: attacker {a_account} (pos {a_pos}) front-ran "
                            f"victim {b_account} (pos {b_pos}) on {asset_pair} "
                            f"in ledger {ledger_idx}. "
                            f"Attacker exited same pair: {a_reappears_same_pair}. "
                            f"Victim trade frequency: {b_trade_count}."
                        ),
                        "a_canonical_pos": a_pos,
                        "b_canonical_pos": b_pos,
                        "a_trade_count_on_pair": a_trade_count,
                        "b_trade_count_on_pair": b_trade_count,
                        "a_reappears_same_pair_within_3_ledgers": a_reappears_same_pair,
                        "estimated_profit_drops": estimated_profit,
                    }

                    candidate = {
                        "anomaly_type": "sandwich",
                        "ledger_index": ledger_idx,
                        "attacker_address": a_account,
                        "victim_address": b_account,
                        "asset_pair": asset_pair,
                        "profit_xrp": estimated_profit / 1_000_000,
                        "confidence_score": round(confidence, 4),
                        "tx_hashes": json.dumps(tx_hashes),
                        "timestamp": a_ts or b_ts,
                        "detail_json": json.dumps(detail),
                        "_occurrence_count": 1,
                    }

                    # Deduplicate: keep highest-confidence instance per (attacker, pair)
                    dedup_key = (a_account, asset_pair)
                    existing = best_per_key.get(dedup_key)
                    if existing is None:
                        best_per_key[dedup_key] = candidate
                    elif candidate["confidence_score"] > existing["confidence_score"]:
                        candidate["_occurrence_count"] = existing["_occurrence_count"] + 1
                        best_per_key[dedup_key] = candidate
                    else:
                        existing["_occurrence_count"] += 1

    # Finalise: strip internal tracking field, embed occurrence count in detail_json
    anomalies = []
    for candidate in best_per_key.values():
        occurrence_count = candidate.pop("_occurrence_count", 1)
        detail = json.loads(candidate["detail_json"])
        detail["occurrence_count"] = occurrence_count
        candidate["detail_json"] = json.dumps(detail)
        anomalies.append(candidate)

    logger.info("Sandwich detection found %d anomalies.", len(anomalies))
    return anomalies
