"""
CSV ingestion loader for transactions and ledger closes.
Reads from the .claudeignore/data/ directory relative to the project root.
"""

import ast
import logging
import os
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd
import numpy as np
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Resolve data paths relative to this file's location (backend/ → project root)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_DATA_DIR = _PROJECT_ROOT / ".claudeignore" / "data"
TRANSACTIONS_CSV = _DATA_DIR / "transactions.csv"
LEDGER_CSV = _DATA_DIR / "ledger.csv"

# Fallback: csvs at project root (as seen in the directory listing)
if not TRANSACTIONS_CSV.exists():
    TRANSACTIONS_CSV = _PROJECT_ROOT / "transactions.csv"
if not LEDGER_CSV.exists():
    LEDGER_CSV = _PROJECT_ROOT / "ledger.csv"


def _safe_parse_dict(val):
    """Attempt to parse a string that might be a Python/JSON dict literal."""
    if pd.isna(val) or val == "" or val is None:
        return None
    if isinstance(val, (int, float)):
        return val
    val_str = str(val).strip()
    if not val_str or val_str == "nan":
        return None
    try:
        return ast.literal_eval(val_str)
    except Exception:
        return val_str


def _extract_amount(val) -> float | None:
    """
    Extract a numeric drop-amount from the `amount` column.
    Can be:
      - plain number string: "460"
      - dict with 'value' key: {"value": "460"} or {"value": "460", "currency": "XRP"}
    Returns float or None.
    """
    parsed = _safe_parse_dict(val)
    if parsed is None:
        return None
    if isinstance(parsed, dict):
        v = parsed.get("value")
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None
    try:
        return float(parsed)
    except (TypeError, ValueError):
        return None


def _extract_currency(val) -> str:
    """
    Extract currency string from a taker_gets/taker_pays column value.
    If it's a dict, return parsed['currency']. Otherwise return 'XRP'.
    """
    parsed = _safe_parse_dict(val)
    if parsed is None:
        return "XRP"
    if isinstance(parsed, dict):
        currency = parsed.get("currency", "XRP")
        if not currency or currency == "XRP":
            return "XRP"
        # Long hex currency codes → truncate for readability
        if len(str(currency)) > 10 and all(c in "0123456789ABCDEFabcdef" for c in str(currency)):
            return str(currency)[:8]
        return str(currency)
    return "XRP"


def _parse_asset_pair(taker_gets, taker_pays) -> str | None:
    """Build asset_pair string like 'XRP/RLUSD' from taker_gets and taker_pays."""
    gets_str = str(taker_gets) if not pd.isna(taker_gets) and taker_gets not in ("", None) else None
    pays_str = str(taker_pays) if not pd.isna(taker_pays) and taker_pays not in ("", None) else None
    if gets_str is None or pays_str is None:
        return None
    gets_currency = _extract_currency(gets_str)
    pays_currency = _extract_currency(pays_str)
    return f"{pays_currency}/{gets_currency}"


def _parse_timestamp(val) -> str | None:
    """Convert 'YYYY-Mon-DD HH:MM:SS UTC' (or close_time_iso) to ISO 8601 string."""
    if pd.isna(val) or not val:
        return None
    val_str = str(val).strip()
    # Try ISO format first (ledger CSV uses close_time_iso directly)
    for fmt in (
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%b-%d %H:%M:%S UTC",
    ):
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return val_str  # Return as-is if unparseable


def _load_transactions_df() -> pd.DataFrame:
    """Load and pre-process the transactions CSV."""
    logger.info("Reading transactions CSV from %s ...", TRANSACTIONS_CSV)
    chunks = []
    for chunk in pd.read_csv(
        TRANSACTIONS_CSV,
        low_memory=False,
        chunksize=5000,
        usecols=lambda c: c in {
            "account", "transaction_type", "hash", "ledger_index",
            "fee", "amount", "destination", "taker_gets", "taker_pays",
            "ledger_close_time_human",
        },
    ):
        chunks.append(chunk)
    df = pd.concat(chunks, ignore_index=True)
    logger.info("Loaded %d transaction rows", len(df))

    # Drop rows with no hash (unusable)
    df = df.dropna(subset=["hash"])
    df["hash"] = df["hash"].astype(str).str.strip()
    df = df[df["hash"] != ""]

    # Parse amount
    df["amount_drops"] = df["amount"].apply(_extract_amount)

    # Parse fee
    df["fee_drops"] = pd.to_numeric(df["fee"], errors="coerce")

    # Exec price: fee / amount in drops
    df["exec_price"] = np.where(
        (df["amount_drops"].notna()) & (df["amount_drops"] > 0),
        df["fee_drops"] / df["amount_drops"],
        None,
    )

    # Timestamp
    df["timestamp"] = df["ledger_close_time_human"].apply(_parse_timestamp)

    # Asset pair
    tg = df.get("taker_gets", pd.Series(dtype=str))
    tp = df.get("taker_pays", pd.Series(dtype=str))
    df["asset_pair"] = [
        _parse_asset_pair(gets, pays)
        for gets, pays in zip(tg, tp)
    ]

    # Canonical position = row rank within each ledger_index group
    df["ledger_index"] = pd.to_numeric(df["ledger_index"], errors="coerce")
    df = df.sort_values(["ledger_index"], na_position="last")
    df["canonical_position"] = df.groupby("ledger_index").cumcount()

    # Rename for DB model
    df = df.rename(columns={"transaction_type": "tx_type"})

    return df


def _load_ledger_df() -> pd.DataFrame:
    """Load and pre-process the ledger closes CSV."""
    logger.info("Reading ledger CSV from %s ...", LEDGER_CSV)
    df = pd.read_csv(LEDGER_CSV, low_memory=False)
    logger.info("Loaded %d ledger rows", len(df))

    # Prefer close_time_iso, fall back to close_time_human
    close_col = "close_time_iso" if "close_time_iso" in df.columns else "close_time_human"
    df["close_time"] = df[close_col].apply(_parse_timestamp)
    df["total_coins"] = pd.to_numeric(df.get("total_coins"), errors="coerce")
    df["transaction_count"] = pd.to_numeric(df.get("transaction_count"), errors="coerce")
    df["ledger_index"] = pd.to_numeric(df["ledger_index"], errors="coerce")

    return df[["ledger_index", "close_time", "transaction_count", "total_coins"]].dropna(
        subset=["ledger_index"]
    )


async def load_ledgers(db_session: AsyncSession) -> None:
    """Bulk-insert ledger_closes rows, skipping existing primary keys."""
    df = _load_ledger_df()

    # Get existing ledger indices to skip
    result = await db_session.execute(text("SELECT ledger_index FROM ledger_closes"))
    existing = {row[0] for row in result.fetchall()}
    logger.info("Found %d existing ledger rows, inserting new ones...", len(existing))

    new_rows = df[~df["ledger_index"].isin(existing)]
    if new_rows.empty:
        logger.info("No new ledger rows to insert.")
        return

    records = new_rows.to_dict("records")
    await db_session.execute(
        text(
            "INSERT OR IGNORE INTO ledger_closes "
            "(ledger_index, close_time, transaction_count, total_coins) "
            "VALUES (:ledger_index, :close_time, :transaction_count, :total_coins)"
        ),
        records,
    )
    await db_session.commit()
    logger.info("Inserted %d ledger rows.", len(records))


async def load_transactions(db_session: AsyncSession) -> None:
    """Bulk-insert transaction rows in chunks of 5000, skipping existing hashes."""
    logger.info("Starting transaction ingestion ...")

    # Get existing hashes
    result = await db_session.execute(text("SELECT hash FROM transactions"))
    existing_hashes = {row[0] for row in result.fetchall()}
    logger.info("Found %d existing transaction hashes.", len(existing_hashes))

    chunk_size = 5000
    insert_count = 0
    row_offset = 0

    for chunk in pd.read_csv(
        TRANSACTIONS_CSV,
        low_memory=False,
        chunksize=chunk_size,
        usecols=lambda c: c in {
            "account", "transaction_type", "hash", "ledger_index",
            "fee", "amount", "destination", "taker_gets", "taker_pays",
            "ledger_close_time_human", "sequence",
        },
    ):
        # hash column is often empty in the CSV — generate a stable synthetic key
        if "hash" not in chunk.columns:
            chunk["hash"] = None
        chunk["hash"] = chunk["hash"].astype(str).str.strip()
        mask_empty = chunk["hash"].isin(["", "nan", "None"])
        seq = chunk.get("sequence", pd.Series(dtype=str)).fillna("").astype(str)
        acct = chunk.get("account", pd.Series(dtype=str)).fillna("").astype(str)
        li = chunk.get("ledger_index", pd.Series(dtype=str)).fillna("").astype(str)
        synthetic = acct + "_" + li + "_" + seq + "_" + pd.Series(
            range(row_offset, row_offset + len(chunk)), index=chunk.index
        ).astype(str)
        chunk.loc[mask_empty, "hash"] = synthetic[mask_empty]
        row_offset += len(chunk)

        # Filter out already-inserted
        chunk = chunk[~chunk["hash"].isin(existing_hashes)]
        if chunk.empty:
            continue

        chunk["amount_drops"] = chunk["amount"].apply(_extract_amount)
        chunk["fee_drops"] = pd.to_numeric(chunk["fee"], errors="coerce")
        chunk["exec_price"] = np.where(
            (chunk["amount_drops"].notna()) & (chunk["amount_drops"] > 0),
            chunk["fee_drops"] / chunk["amount_drops"],
            None,
        )
        chunk["timestamp"] = chunk["ledger_close_time_human"].apply(_parse_timestamp)

        tg = chunk.get("taker_gets", pd.Series(dtype=str))
        tp = chunk.get("taker_pays", pd.Series(dtype=str))
        chunk["asset_pair"] = [
            _parse_asset_pair(gets, pays)
            for gets, pays in zip(tg, tp)
        ]

        chunk["ledger_index"] = pd.to_numeric(chunk["ledger_index"], errors="coerce")
        chunk["canonical_position"] = chunk.groupby("ledger_index").cumcount()
        chunk = chunk.rename(columns={"transaction_type": "tx_type"})

        columns = [
            "hash", "ledger_index", "account", "tx_type", "destination",
            "amount_drops", "fee_drops", "exec_price", "timestamp",
            "asset_pair", "canonical_position",
        ]
        for col in columns:
            if col not in chunk.columns:
                chunk[col] = None

        records = chunk[columns].where(pd.notnull(chunk[columns]), None).to_dict("records")

        await db_session.execute(
            text(
                "INSERT OR IGNORE INTO transactions "
                "(hash, ledger_index, account, tx_type, destination, "
                " amount_drops, fee_drops, exec_price, timestamp, "
                " asset_pair, canonical_position) "
                "VALUES (:hash, :ledger_index, :account, :tx_type, :destination, "
                " :amount_drops, :fee_drops, :exec_price, :timestamp, "
                " :asset_pair, :canonical_position)"
            ),
            records,
        )
        await db_session.commit()

        existing_hashes.update(chunk["hash"].tolist())
        insert_count += len(records)
        logger.info("Inserted %d transactions so far...", insert_count)

    logger.info("Transaction ingestion complete. Total inserted: %d", insert_count)


async def seed_database(db_session: AsyncSession) -> None:
    """Seed both ledger closes and transactions into the database."""
    logger.info("Seeding database from CSVs...")
    await load_ledgers(db_session)
    await load_transactions(db_session)
    logger.info("Database seeding complete.")
