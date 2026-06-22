from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# We talk to Supabase's connection POOLER (Supavisor), not Postgres directly, so
# the old "15 server connections" cap doesn't apply to the client pool — Supavisor
# multiplexes hundreds of client connections onto a few server ones. A small pool
# was actually the bottleneck: each page fires several API calls in parallel, and
# with only 2 warm connections the rest serialized or re-established cold
# connections (~380ms each to Sydney). A roomy pool keeps connections warm and lets
# a page's requests run concurrently (measured ~3x faster page loads).
# statement_cache_size=0 is required for PgBouncer transaction mode (port 6543).
# timeout=60 prevents indefinite hangs on first SSL handshake via asyncpg.
engine = create_async_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=False,   # avoid an extra SELECT 1 round trip per checkout
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
    pool_size=3,
    max_overflow=2,
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
