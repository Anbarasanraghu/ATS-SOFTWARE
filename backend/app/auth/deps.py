import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_token
from app.db.session import SessionLocal, set_tenant_context

bearer_scheme = HTTPBearer()


class TokenUser:
    """Request user built straight from the JWT — avoids a per-request DB read.
    Carries everything the routers use (id, tenant_id, email, name, admin, role)."""
    __slots__ = ("id", "tenant_id", "email", "full_name", "is_platform_admin", "role", "status")

    def __init__(self, payload: dict):
        self.id = uuid.UUID(payload["sub"])
        self.tenant_id = uuid.UUID(payload["tid"])
        self.email = payload.get("email")
        self.full_name = payload.get("name")
        self.is_platform_admin = bool(payload.get("adm", False))
        self.role = payload.get("role", "member")
        self.status = "active"


async def get_request_context(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    payload = decode_token(creds.credentials)
    if not payload or "tid" not in payload or "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    user = TokenUser(payload)
    async with SessionLocal() as session:
        async with session.begin():
            await set_tenant_context(session, user.tenant_id)
            yield {"session": session, "user": user, "tenant_id": str(user.tenant_id)}

from app.db.session import AdminSessionLocal


async def get_admin_context(ctx=Depends(get_request_context)):
    if not ctx["user"].is_platform_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform admin only")
    async with AdminSessionLocal() as session:
        async with session.begin():
            yield {"session": session, "user": ctx["user"]}