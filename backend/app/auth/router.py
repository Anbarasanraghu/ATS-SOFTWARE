import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select

from app.auth.deps import get_request_context
from app.auth.schemas import LoginIn, TokenOut
from app.core.security import create_access_token, verify_password
from app.db.models import Module, Tenant, TenantModule, User, UserModule
from app.db.session import SessionLocal, set_tenant_context

router = APIRouter()

_DB_DOWN = HTTPException(
    status.HTTP_503_SERVICE_UNAVAILABLE,
    "Database unavailable. Your Supabase project may be paused — restore it at supabase.com/dashboard.",
)


def _db_error(exc: Exception) -> HTTPException:
    err = str(exc)
    if isinstance(exc, (asyncio.CancelledError, asyncio.TimeoutError, TimeoutError, OSError)):
        return _DB_DOWN
    if "EMAXCONNSESSION" in err or "max clients" in err:
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                             "Too many database connections. Restart the backend server.")
    if "relation" in err and "does not exist" in err:
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                             "Database tables missing. Run SQL migrations in your Supabase SQL Editor.")
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {err}")


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn):
    try:
        async with SessionLocal() as session:
            async with session.begin():
                tenant = (
                    await session.execute(select(Tenant).where(Tenant.slug == body.tenant_slug))
                ).scalar_one_or_none()
                if tenant is None:
                    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

                await set_tenant_context(session, tenant.id)
                user = (
                    await session.execute(select(User).where(User.email == body.email))
                ).scalar_one_or_none()
                if (
                    user is None
                    or not user.password_hash
                    or not verify_password(body.password, user.password_hash)
                ):
                    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

                token = create_access_token(
                    user_id=user.id, tenant_id=tenant.id,
                    email=user.email, full_name=user.full_name,
                    is_platform_admin=user.is_platform_admin, role=user.role,
                )
    except HTTPException:
        raise
    except asyncio.CancelledError:
        raise _DB_DOWN
    except Exception as exc:
        raise _db_error(exc) from exc

    return TokenOut(access_token=token)


@router.get("/me")
async def me(ctx=Depends(get_request_context)):
    session = ctx["session"]
    user = ctx["user"]

    try:
        tenant = (
            await session.execute(select(Tenant).where(Tenant.id == user.tenant_id))
        ).scalar_one()

        # Effective modules: owner/admin (and platform admin) get every module the
        # tenant has enabled; everyone else only gets the modules assigned to them.
        privileged = user.is_platform_admin or user.role in ("owner", "admin")
        q = (
            select(Module.code)
            .join(TenantModule, TenantModule.module_id == Module.id)
            .where(TenantModule.enabled.is_(True))
        )
        if not privileged:
            q = q.join(UserModule, and_(
                UserModule.module_id == Module.id,
                UserModule.user_id == user.id,
            ))
        module_codes = (await session.execute(q)).scalars().all()
    except HTTPException:
        raise
    except asyncio.CancelledError:
        raise _DB_DOWN
    except Exception as exc:
        raise _db_error(exc) from exc

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_platform_admin": user.is_platform_admin,
            "role": user.role,
        },
        "tenant": {"slug": tenant.slug, "name": tenant.name, "vertical": tenant.vertical},
        "modules": list(module_codes),
    }
