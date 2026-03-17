"""
SQLAlchemy async database setup for XRPL Anomaly Detection.
Uses SQLite via aiosqlite for async support.
"""

import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Text, Integer, Float, String

logger = logging.getLogger(__name__)

DATABASE_URL = "sqlite+aiosqlite:///./ripple.db"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


class Transaction(Base):
    __tablename__ = "transactions"

    hash: Mapped[str] = mapped_column(String, primary_key=True)
    ledger_index: Mapped[int] = mapped_column(Integer, index=True, nullable=True)
    account: Mapped[str] = mapped_column(String, index=True, nullable=True)
    tx_type: Mapped[str] = mapped_column(String, nullable=True)
    destination: Mapped[str] = mapped_column(String, nullable=True)
    amount_drops: Mapped[float] = mapped_column(Float, nullable=True)
    fee_drops: Mapped[float] = mapped_column(Float, nullable=True)
    exec_price: Mapped[float] = mapped_column(Float, nullable=True)
    timestamp: Mapped[str] = mapped_column(Text, nullable=True)
    asset_pair: Mapped[str] = mapped_column(String, nullable=True)
    canonical_position: Mapped[int] = mapped_column(Integer, nullable=True)


class LedgerClose(Base):
    __tablename__ = "ledger_closes"

    ledger_index: Mapped[int] = mapped_column(Integer, primary_key=True)
    close_time: Mapped[str] = mapped_column(Text, nullable=True)
    transaction_count: Mapped[int] = mapped_column(Integer, nullable=True)
    total_coins: Mapped[float] = mapped_column(Float, nullable=True)


class AnomalyFlag(Base):
    __tablename__ = "anomaly_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    anomaly_type: Mapped[str] = mapped_column(String, nullable=True, index=True)
    ledger_index: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    attacker_address: Mapped[str] = mapped_column(String, nullable=True, index=True)
    victim_address: Mapped[str] = mapped_column(String, nullable=True)
    asset_pair: Mapped[str] = mapped_column(String, nullable=True)
    profit_xrp: Mapped[float] = mapped_column(Float, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=True)
    tx_hashes: Mapped[str] = mapped_column(Text, nullable=True)
    timestamp: Mapped[str] = mapped_column(Text, nullable=True)
    detail_json: Mapped[str] = mapped_column(Text, nullable=True)


class AddressMetric(Base):
    __tablename__ = "address_metrics"

    address: Mapped[str] = mapped_column(String, primary_key=True)
    daily_tx_count: Mapped[int] = mapped_column(Integer, nullable=True)
    offer_cancel_rate: Mapped[float] = mapped_column(Float, nullable=True)
    ngfr: Mapped[float] = mapped_column(Float, nullable=True)
    rtr: Mapped[float] = mapped_column(Float, nullable=True)
    isolation_score: Mapped[float] = mapped_column(Float, nullable=True)
    intra_cluster_ratio: Mapped[float] = mapped_column(Float, nullable=True)
    last_updated: Mapped[str] = mapped_column(Text, nullable=True)


async def init_db():
    """Create all tables if they do not exist."""
    logger.info("Initialising database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready.")
