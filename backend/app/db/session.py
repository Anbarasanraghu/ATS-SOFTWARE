from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# We talk to Supabase's connection POOLER (Supavisor), not Postgres directly. A
# roomy-ish pool lets each page's parallel API calls run concurrently instead of
# serializing (the old pool_size=2 was the main slowness). BUT the pooler drops
# idle connections, so pool_pre_ping=True is REQUIRED — without it, SQLAlchemy
# hands out a dead connection and the request fails with "connection is closed".
# pool_recycle keeps connections younger than the pooler's idle timeout so the
# pre-ping rarely has to actually reconnect.
# statement_cache_size=0 is required for PgBouncer transaction mode (port 6543).
# timeout=60 prevents indefinite hangs on first SSL handshake via asyncpg.
engine = create_async_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=300,
    pool_pre_ping=True,
    echo=False,
    connect_args={
        "statement_cache_size": 0,
        "timeout": 60,
        "command_timeout": 60,
    },
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

admin_engine = create_async_engine(
    settings.admin_database_url or settings.database_url,
    pool_size=2,
    max_overflow=3,
    pool_timeout=30,
    pool_recycle=300,
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0, "timeout": 60},
)
AdminSessionLocal = async_sessionmaker(admin_engine, class_=AsyncSession, expire_on_commit=False)


async def set_tenant_context(session: AsyncSession, tenant_id) -> None:
    await session.execute(
        text("select set_config('app.tenant_id', :tid, true)"),
        {"tid": str(tenant_id)},
    )
