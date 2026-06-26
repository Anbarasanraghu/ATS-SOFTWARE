"""
Tenant-side team management.

The tenant owner (and anyone they promote to 'admin') can add users for their
office — up to the paid seat limit the platform admin granted (tenants.max_users).
Each active user is one seat. Owners/admins decide which modules each user can
access (stored in user_modules; surfaced by /auth/me).

Everything runs on the tenant-scoped RLS session, so a tenant can only ever see
and modify its own users.
"""
from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.auth.deps import get_request_context
from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Module, TenantModule, Tenant, User, UserModule
from app.team.schemas import (
    CreateUserIn, SeatsOut, TeamModuleOut, TeamUserOut, UpdateUserIn,
)

router = APIRouter()

ASSIGNABLE_ROLES = {"member", "manager", "admin"}


def _require_manager(user) -> None:
    if not (getattr(user, "is_platform_admin", False) or user.role in ("owner", "admin")):
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only the owner or an admin can manage users.")


async def _enabled_modules(session) -> list[tuple[str, str, str]]:
    """(module_id, code, name) for modules enabled for the current tenant."""
    rows = (await session.execute(
        select(Module.id, Module.code, Module.name)
        .join(TenantModule, TenantModule.module_id == Module.id)
        .where(TenantModule.enabled.is_(True))
        .order_by(Module.category, Module.name)
    )).all()
    return [(str(i), c, n) for i, c, n in rows]


async def _active_count(session) -> int:
    return (await session.execute(
        select(func.count()).select_from(User).where(User.status == "active")
    )).scalar() or 0


async def _seats(session, user) -> SeatsOut:
    tenant = (await session.execute(
        select(Tenant).where(Tenant.id == user.tenant_id)
    )).scalar_one()
    active = await _active_count(session)
    price = settings.price_per_user
    return SeatsOut(
        max_users=tenant.max_users,
        active_users=active,
        available=max(0, tenant.max_users - active),
        price_per_user=price,
        monthly_total=active * price,
        can_add=active < tenant.max_users,
    )


@router.get("/seats", response_model=SeatsOut)
async def get_seats(ctx=Depends(get_request_context)):
    _require_manager(ctx["user"])
    return await _seats(ctx["session"], ctx["user"])


@router.get("/modules", response_model=list[TeamModuleOut])
async def list_modules(ctx=Depends(get_request_context)):
    _require_manager(ctx["user"])
    mods = await _enabled_modules(ctx["session"])
    return [TeamModuleOut(module_id=i, code=c, name=n) for i, c, n in mods]


@router.get("/users", response_model=list[TeamUserOut])
async def list_users(ctx=Depends(get_request_context)):
    session = ctx["session"]
    _require_manager(ctx["user"])

    enabled = await _enabled_modules(session)
    enabled_codes = [c for _, c, _ in enabled]

    assigned: dict = defaultdict(list)
    for uid, code in (await session.execute(
        select(UserModule.user_id, Module.code)
        .join(Module, Module.id == UserModule.module_id)
    )).all():
        assigned[uid].append(code)

    users = (await session.execute(select(User).order_by(User.email))).scalars().all()
    out = []
    for u in users:
        privileged = u.is_platform_admin or u.role in ("owner", "admin")
        out.append(TeamUserOut(
            id=str(u.id), email=u.email, full_name=u.full_name,
            role=u.role, status=u.status, is_owner=(u.role == "owner"),
            modules=enabled_codes if privileged else assigned.get(u.id, []),
        ))
    return out


async def _set_user_modules(session, user, target_id, codes: list[str]) -> None:
    """Replace a user's module grants with the given codes (only modules the
    tenant actually has enabled are accepted)."""
    enabled = {c: i for i, c, _ in await _enabled_modules(session)}
    await session.execute(
        UserModule.__table__.delete().where(UserModule.user_id == target_id)
    )
    for code in set(codes):
        mid = enabled.get(code)
        if mid:
            session.add(UserModule(tenant_id=user.tenant_id, user_id=target_id, module_id=mid))


@router.post("/users", response_model=TeamUserOut, status_code=201)
async def create_user(body: CreateUserIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    _require_manager(user)

    role = (body.role or "member").lower()
    if role not in ASSIGNABLE_ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Role must be one of: {', '.join(sorted(ASSIGNABLE_ROLES))}.")
    if len(body.password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 6 characters.")

    email = str(body.email).strip().lower()
    dupe = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if dupe:
        raise HTTPException(status.HTTP_409_CONFLICT, "A user with that email already exists.")

    seats = await _seats(session, user)
    if not seats.can_add:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Seat limit reached ({seats.max_users} of {seats.max_users} used). "
            "Ask your provider to add more seats.",
        )

    new_user = User(
        tenant_id=user.tenant_id, email=email,
        full_name=(body.full_name or "").strip() or None,
        password_hash=hash_password(body.password),
        status="active", role=role, is_platform_admin=False,
    )
    session.add(new_user)
    await session.flush()
    await _set_user_modules(session, user, new_user.id, body.modules)

    privileged = role in ("owner", "admin")
    enabled_codes = [c for _, c, _ in await _enabled_modules(session)]
    return TeamUserOut(
        id=str(new_user.id), email=new_user.email, full_name=new_user.full_name,
        role=new_user.role, status=new_user.status, is_owner=False,
        modules=enabled_codes if privileged else list(set(body.modules) & set(enabled_codes)),
    )


@router.patch("/users/{user_id}", response_model=TeamUserOut)
async def update_user(user_id: str, body: UpdateUserIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    _require_manager(user)

    if str(user.id) == user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't edit your own account here.")

    target = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if target.role == "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The owner account can't be modified here.")

    if body.role is not None:
        role = body.role.lower()
        if role not in ASSIGNABLE_ROLES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role.")
        target.role = role
    if body.full_name is not None:
        target.full_name = body.full_name.strip() or None
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 6 characters.")
        target.password_hash = hash_password(body.password)
    if body.status is not None:
        new_status = body.status.lower()
        if new_status not in ("active", "disabled"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Status must be 'active' or 'disabled'.")
        # Reactivating consumes a seat — re-check the limit.
        if new_status == "active" and target.status != "active":
            seats = await _seats(session, user)
            if not seats.can_add:
                raise HTTPException(status.HTTP_403_FORBIDDEN,
                                    "Seat limit reached — can't reactivate this user.")
        target.status = new_status
    if body.modules is not None:
        await _set_user_modules(session, user, target.id, body.modules)

    await session.flush()

    privileged = target.role in ("owner", "admin")
    enabled = await _enabled_modules(session)
    enabled_codes = [c for _, c, _ in enabled]
    assigned = [code for (uid, code) in (await session.execute(
        select(UserModule.user_id, Module.code).join(Module, Module.id == UserModule.module_id)
        .where(UserModule.user_id == target.id)
    )).all()]
    return TeamUserOut(
        id=str(target.id), email=target.email, full_name=target.full_name,
        role=target.role, status=target.status, is_owner=False,
        modules=enabled_codes if privileged else assigned,
    )


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: str, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    _require_manager(user)

    if str(user.id) == user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't delete your own account.")
    target = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    if target.role == "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The owner account can't be deleted.")

    await session.execute(User.__table__.delete().where(User.id == user_id))
    return None
