from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Pool sizes kept small: Supabase free tier caps at 15 total server connections.
# Main engine: max 3 (pool_size=2 + max_overflow=1)
# Admin engine: max 2 (pool_size=1 + max_overflow=1)
# Total: 5 — leaves headroom for a --reload overlap without hitting the cap.
# statement_cache_size=0 is required for PgBouncer transaction mode (port 6543).
# timeout=60 prevents indefinite hangs on first SSL handshake via asyncpg.
engine = create_async_engine(
    settings.database_url,
    pool_size=2,
    max_overflow=1,
    pool_timeout=30,
    pool_recycle=1800,
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
    pool_size=1,
    max_overflow=1,
    pool_timeout=30,
    pool_recycle=1800,
    connect_args={"statement_cache_size": 0, "timeout": 60},
)
AdminSessionLocal = async_sessionmaker(admin_engine, class_=AsyncSession, expire_on_commit=False)


async def set_tenant_context(session: AsyncSession, tenant_id) -> None:
    await session.execute(
        text("select set_config('app.tenant_id', :tid, true)"),
        {"tid": str(tenant_id)},
    )
