import asyncio
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_token
from app.db.session import AdminSessionLocal, SessionLocal, set_tenant_context

bearer_scheme = HTTPBearer()


class TokenUser:
    """Request user built from JWT claims — avoids a per-request DB read."""
    __slots__ = ("id", "tenant_id", "email", "full_name", "is_platform_admin", "role", "status")

    def __init__(self, payload: dict):
        self.id = uuid.UUID(payload["sub"])
        self.tenant_id = uuid.UUID(payload["tid"])
        self.email = payload.get("email")
        self.full_name = payload.get("name")
        self.is_platform_admin = bool(payload.get("adm", False))
        self.role = payload.get("role", "member")
        self.status = "active"


def _db_503(exc: Exception) -> HTTPException:
    err = str(exc)
    if isinstance(exc, (asyncio.CancelledError, asyncio.TimeoutError, TimeoutError, OSError)):
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                             "Database unavailable. Your Supabase project may be paused — restore it at supabase.com/dashboard.")
    if "EMAXCONNSESSION" in err or "max clients" in err:
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                             "Too many database connections. Restart the backend server.")
    if "relation" in err and "does not exist" in err:
        return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                             "Database tables missing. Run SQL migrations in your Supabase SQL Editor.")
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Database error: {err}")


async def get_request_context(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    payload = decode_token(creds.credentials)
    if not payload or "tid" not in payload or "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user = TokenUser(payload)
    try:
        async with SessionLocal() as session:
            async with session.begin():
                await set_tenant_context(session, user.tenant_id)
                yield {"session": session, "user": user, "tenant_id": str(user.tenant_id)}
    except HTTPException:
        raise
    except asyncio.CancelledError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            "Database unavailable. Your Supabase project may be paused.")
    except Exception as exc:
        raise _db_503(exc) from exc


async def get_admin_context(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    payload = decode_token(creds.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = TokenUser(payload)
    if not user.is_platform_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform admin only")
    try:
        async with AdminSessionLocal() as session:
            async with session.begin():
                yield {"session": session, "user": user}
    except HTTPException:
        raise
    except asyncio.CancelledError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database unavailable.")
    except Exception as exc:
        raise _db_503(exc) from exc
