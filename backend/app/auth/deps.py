from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from app.core.security import decode_token
from app.db.models import User
from app.db.session import SessionLocal, set_tenant_context

bearer_scheme = HTTPBearer()


async def get_request_context(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = creds.credentials
    payload = decode_token(token)
    if not payload or "tid" not in payload or "sub" not in payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    tenant_id = payload["tid"]
    user_id = payload["sub"]

    async with SessionLocal() as session:
        async with session.begin():
            await set_tenant_context(session, tenant_id)
            user = (
                await session.execute(select(User).where(User.id == user_id))
            ).scalar_one_or_none()
            if user is None or user.status != "active":
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
            yield {"session": session, "user": user, "tenant_id": tenant_id}

from app.db.session import AdminSessionLocal


async def get_admin_context(ctx=Depends(get_request_context)):
    if not ctx["user"].is_platform_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform admin only")
    async with AdminSessionLocal() as session:
        async with session.begin():
            yield {"session": session, "user": ctx["user"]}