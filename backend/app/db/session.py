from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    # No pool_pre_ping: it adds a round trip (SELECT 1) before every request,
    # which is costly against a remote DB. Recycle connections instead.
    pool_recycle=1800,
    pool_size=10,
    max_overflow=10,
    connect_args={"statement_cache_size": 0},
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

admin_engine = create_async_engine(
    settings.admin_database_url or settings.database_url, pool_pre_ping=True
)
AdminSessionLocal = async_sessionmaker(admin_engine, class_=AsyncSession, expire_on_commit=False)

async def set_tenant_context(session: AsyncSession, tenant_id) -> None:
    """Pin the tenant id for the current transaction. Every RLS policy reads
    this via current_tenant_id(). Must be called inside an open transaction."""
    await session.execute(
        text("select set_config('app.tenant_id', :tid, true)"),
        {"tid": str(tenant_id)},
    )