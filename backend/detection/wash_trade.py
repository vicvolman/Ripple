"""
Wash trading detection using NetworkX graph analysis.

Steps:
  1. Build directed graph: nodes=accounts, edges weighted by total amount transferred.
  2. Compute NGFR (Net-to-Gross Flow Ratio) for each directed pair.
     NGFR = |net_flow| / gross_flow  (flag if < 0.05 and gross_flow > 10000 drops)
  3. Compute RTR (Round-Trip Ratio): count A→B followed by B→A within 60-second window.
  4. Find connected components; compute intra_connectivity_ratio per cluster.
     This is the average fraction of each node's neighbours that are also inside
     the cluster — measures how "self-contained" the group is, independent of
     graph size.  Flag clusters where ratio > 0.70 and cluster >= 3 nodes
     AND at least one pair in the cluster has NGFR < 0.05.
  5. Compute dust transaction ratio (amount < 1000 drops).
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

import networkx as nx
import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

NGFR_THRESHOLD = 0.05
GROSS_FLOW_MIN = 10_000      # drops
# Fraction of each node's connections that must be internal to flag a cluster.
# Using per-node average so small clusters aren't penalised by graph size.
INTRA_CONNECTIVITY_THRESHOLD = 0.70
MIN_CLUSTER_SIZE = 3
DUST_THRESHOLD = 1_000       # drops
ROUND_TRIP_WINDOW_SEC = 60


def _parse_iso(ts: str | None) -> float | None:
    """Parse ISO timestamp to Unix epoch float. Returns None on failure."""
    if not ts:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S+00:00", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S+00:00"):
        try:
            return datetime.strptime(ts, fmt).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(ts).timestamp()
    except Exception:
        return None


def _intra_connectivity(G_undirected: nx.Graph, component: set) -> float:
    """
    Compute the average fraction of each node's neighbours that are also
    inside the component.  Returns 1.0 for a fully isolated cluster,
    0.0 for a cluster whose members only connect outward.

    This is independent of total graph size, unlike (intra_edges / total_edges).
    """
    fractions = []
    for node in component:
        neighbours = set(G_undirected.neighbors(node))
        if not neighbours:
            continue
        internal = len(neighbours & component)
        fractions.append(internal / len(neighbours))
    return sum(fractions) / len(fractions) if fractions else 0.0


async def detect_wash_trades(db_session: AsyncSession) -> list[dict[str, Any]]:
    """
    Detect wash trading clusters from transactions stored in the DB.
    Returns anomaly dicts for insertion into anomaly_flags.
    """
    try:
        result = await db_session.execute(
            text(
                """
                SELECT account, destination, amount_drops, timestamp, hash, asset_pair
                FROM transactions
                WHERE account IS NOT NULL AND destination IS NOT NULL
                """
            )
        )
        rows = result.fetchall()
    except Exception as exc:
        logger.error("Error fetching transactions for wash trade detection: %s", exc)
        return []

    if not rows:
        logger.info("No rows available for wash trade detection.")
        return []

    df = pd.DataFrame(rows, columns=["account", "destination", "amount_drops", "timestamp", "hash", "asset_pair"])
    df["amount_drops"] = pd.to_numeric(df["amount_drops"], errors="coerce").fillna(0)

    # ------------------------------------------------------------------ #
    # 1. Build directed weighted graph                                     #
    # ------------------------------------------------------------------ #
    G = nx.DiGraph()
    flow_map: dict[tuple[str, str], float] = {}

    for _, row in df.iterrows():
        src, dst, amt = row["account"], row["destination"], row["amount_drops"]
        if src == dst:
            continue
        key = (src, dst)
        flow_map[key] = flow_map.get(key, 0.0) + amt
        if not G.has_edge(src, dst):
            G.add_edge(src, dst, weight=0.0)
        G[src][dst]["weight"] += amt

    if G.number_of_nodes() == 0:
        logger.info("Empty graph — no wash trade candidates.")
        return []

    # ------------------------------------------------------------------ #
    # 2. NGFR per directed pair                                           #
    # ------------------------------------------------------------------ #
    ngfr_flagged: set[tuple[str, str]] = set()
    ngfr_per_account: dict[str, list[float]] = {}

    for (a, b) in set(flow_map.keys()):
        if (b, a) not in flow_map:
            continue
        ab = flow_map[(a, b)]
        ba = flow_map[(b, a)]
        gross = ab + ba
        if gross < GROSS_FLOW_MIN:
            continue
        ngfr = abs(ab - ba) / gross
        if ngfr < NGFR_THRESHOLD:
            ngfr_flagged.add((a, b))
            ngfr_flagged.add((b, a))
            ngfr_per_account.setdefault(a, []).append(ngfr)
            ngfr_per_account.setdefault(b, []).append(ngfr)

    # ------------------------------------------------------------------ #
    # 3. Round-trip ratio (RTR)                                           #
    # ------------------------------------------------------------------ #
    df["epoch"] = df["timestamp"].apply(_parse_iso)
    rtr_per_account: dict[str, list[float]] = {}

    bidirectional_pairs = {
        (a, b) for (a, b) in flow_map
        if (b, a) in flow_map and a < b
    }

    for (a, b) in bidirectional_pairs:
        ab_times = df[(df["account"] == a) & (df["destination"] == b)]["epoch"].dropna().sort_values().tolist()
        ba_times = df[(df["account"] == b) & (df["destination"] == a)]["epoch"].dropna().sort_values().tolist()
        total = len(ab_times) + len(ba_times)
        if total == 0:
            continue

        round_trips = 0
        j = 0
        for t_ab in ab_times:
            while j < len(ba_times) and ba_times[j] < t_ab:
                j += 1
            if j < len(ba_times) and ba_times[j] - t_ab <= ROUND_TRIP_WINDOW_SEC:
                round_trips += 1

        rtr = round_trips / (total / 2)
        rtr_per_account.setdefault(a, []).append(rtr)
        rtr_per_account.setdefault(b, []).append(rtr)

    rtr_mean: dict[str, float] = {
        addr: sum(vals) / len(vals)
        for addr, vals in rtr_per_account.items()
    }

    # ------------------------------------------------------------------ #
    # 4. Connected components & intra-connectivity ratio                  #
    # ------------------------------------------------------------------ #
    G_undirected = G.to_undirected()
    components = list(nx.connected_components(G_undirected))

    anomalies: list[dict[str, Any]] = []

    for component in components:
        if len(component) < MIN_CLUSTER_SIZE:
            continue

        # Require at least one NGFR-flagged pair inside the cluster
        cluster_has_ngfr = any(
            (a, b) in ngfr_flagged
            for a in component
            for b in component
            if a != b
        )
        if not cluster_has_ngfr:
            continue

        # Per-node internal connectivity (independent of total graph size)
        intra_ratio = _intra_connectivity(G_undirected, component)
        if intra_ratio < INTRA_CONNECTIVITY_THRESHOLD:
            continue

        # Identify highest-volume node as the "primary" account
        volume_by_node = {
            node: sum(d.get("weight", 0) for _, _, d in G.edges(node, data=True))
            for node in component
        }
        attacker = max(volume_by_node, key=volume_by_node.get)  # type: ignore[arg-type]

        # Most common asset_pair in cluster transactions
        cluster_txs = df[df["account"].isin(component) | df["destination"].isin(component)]
        asset_pair_mode = cluster_txs["asset_pair"].dropna().mode()
        asset_pair_str = str(asset_pair_mode.iloc[0]) if not asset_pair_mode.empty else None

        # Average NGFR for the primary account
        ngfr_vals = ngfr_per_account.get(attacker, [1.0])
        avg_ngfr = sum(ngfr_vals) / len(ngfr_vals)

        # Confidence: low NGFR (near-equal flows) + high intra-connectivity
        conf_ngfr = max(0.0, 1.0 - avg_ngfr / NGFR_THRESHOLD) * 0.5
        conf_cluster = intra_ratio * 0.5
        confidence = round(conf_ngfr + conf_cluster, 4)

        ts = cluster_txs["timestamp"].dropna().sort_values().iloc[-1] if not cluster_txs.empty else None

        top_accounts = sorted(volume_by_node, key=volume_by_node.get, reverse=True)[:5]  # type: ignore[arg-type]

        detail = {
            "description": (
                f"Wash trading cluster of {len(component)} accounts "
                f"with intra-connectivity {intra_ratio:.3f} "
                f"and avg NGFR {avg_ngfr:.4f} on {asset_pair_str}."
            ),
            "cluster_size": len(component),
            "intra_connectivity_ratio": intra_ratio,
            "avg_ngfr": avg_ngfr,
            "avg_rtr": rtr_mean.get(attacker, 0.0),
            "top_accounts": top_accounts,
        }

        anomalies.append(
            {
                "anomaly_type": "wash_trade",
                "ledger_index": None,
                "attacker_address": attacker,
                "victim_address": None,
                "asset_pair": asset_pair_str,
                "profit_xrp": 0.0,
                "confidence_score": confidence,
                "tx_hashes": json.dumps([]),
                "timestamp": str(ts) if ts is not None else None,
                "detail_json": json.dumps(detail),
            }
        )

    logger.info("Wash trade detection found %d cluster anomalies.", len(anomalies))
    return anomalies


async def compute_address_metrics(db_session: AsyncSession) -> list[dict[str, Any]]:
    """
    Compute per-address metrics for use by the Isolation Forest.

    Returns list of dicts with:
      address, daily_tx_count, offer_cancel_rate, ngfr, rtr, intra_cluster_ratio
    """
    try:
        result = await db_session.execute(
            text(
                """
                SELECT account, destination, amount_drops, tx_type, timestamp
                FROM transactions
                WHERE account IS NOT NULL
                """
            )
        )
        rows = result.fetchall()
    except Exception as exc:
        logger.error("Error fetching transactions for address metrics: %s", exc)
        return []

    if not rows:
        return []

    df = pd.DataFrame(rows, columns=["account", "destination", "amount_drops", "tx_type", "timestamp"])
    df["amount_drops"] = pd.to_numeric(df["amount_drops"], errors="coerce").fillna(0)

    # Daily tx count (data covers ~2.5 hours → scale to 24h)
    tx_counts = df.groupby("account").size().rename("tx_count")
    daily_tx = (tx_counts * 9.6).round().astype(int)

    # Offer cancel rate
    offer_creates = df[df["tx_type"] == "OfferCreate"].groupby("account").size()
    offer_cancels = df[df["tx_type"] == "OfferCancel"].groupby("account").size()
    all_offers = offer_creates.add(offer_cancels, fill_value=0)
    cancel_rate = offer_cancels.div(all_offers.replace(0, float("nan"))).fillna(0)

    # NGFR per account (average across all pairs involving the account)
    df_filt = df[df["destination"].notna()]
    flow_map: dict[tuple[str, str], float] = {}
    for _, row in df_filt.iterrows():
        src, dst, amt = row["account"], row["destination"], row["amount_drops"]
        if src == dst:
            continue
        key = (src, dst)
        flow_map[key] = flow_map.get(key, 0.0) + amt

    ngfr_per_account: dict[str, list[float]] = {}
    for (a, b) in flow_map:
        if (b, a) not in flow_map:
            continue
        ab, ba = flow_map[(a, b)], flow_map[(b, a)]
        gross = ab + ba
        if gross < GROSS_FLOW_MIN:
            continue
        ngfr = abs(ab - ba) / gross
        ngfr_per_account.setdefault(a, []).append(ngfr)
        ngfr_per_account.setdefault(b, []).append(ngfr)

    ngfr_mean = {addr: sum(v) / len(v) for addr, v in ngfr_per_account.items()}

    # RTR per account
    rtr_per_account: dict[str, float] = {}
    df["epoch"] = df["timestamp"].apply(_parse_iso)
    bidirectional = {(a, b) for (a, b) in flow_map if (b, a) in flow_map and a < b}

    for (a, b) in bidirectional:
        ab_times = df[(df["account"] == a) & (df["destination"] == b)]["epoch"].dropna().sort_values().tolist()
        ba_times = df[(df["account"] == b) & (df["destination"] == a)]["epoch"].dropna().sort_values().tolist()
        total = len(ab_times) + len(ba_times)
        if total == 0:
            continue
        round_trips = 0
        j = 0
        for t_ab in ab_times:
            while j < len(ba_times) and ba_times[j] < t_ab:
                j += 1
            if j < len(ba_times) and ba_times[j] - t_ab <= ROUND_TRIP_WINDOW_SEC:
                round_trips += 1
        rtr = round_trips / (total / 2)
        rtr_per_account[a] = rtr_per_account.get(a, 0.0) + rtr
        rtr_per_account[b] = rtr_per_account.get(b, 0.0) + rtr

    # Intra-cluster ratio (per-node connectivity fraction)
    G = nx.DiGraph()
    for (src, dst), w in flow_map.items():
        G.add_edge(src, dst, weight=w)
    G_undirected = G.to_undirected()
    cluster_ratio: dict[str, float] = {}
    for component in nx.connected_components(G_undirected):
        ratio = _intra_connectivity(G_undirected, component)
        for addr in component:
            cluster_ratio[addr] = ratio

    all_addresses = df["account"].unique().tolist()
    now_str = datetime.now(timezone.utc).isoformat()

    metrics = []
    for addr in all_addresses:
        metrics.append(
            {
                "address": addr,
                "daily_tx_count": int(daily_tx.get(addr, 0)),
                "offer_cancel_rate": float(cancel_rate.get(addr, 0.0)),
                "ngfr": float(ngfr_mean.get(addr, 1.0)),
                "rtr": float(rtr_per_account.get(addr, 0.0)),
                "intra_cluster_ratio": float(cluster_ratio.get(addr, 0.0)),
                "last_updated": now_str,
            }
        )

    logger.info("Computed address metrics for %d addresses.", len(metrics))
    return metrics
