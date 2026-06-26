from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import and_, func, select

from app.auth.deps import get_admin_context
from app.core.config import settings
from app.core.security import hash_password
from app.db.models import FieldDefinition, Module, Tenant, TenantModule, User

router = APIRouter()


class TenantOut(BaseModel):
    id: str
    name: str
    slug: str
    vertical: str
    max_users: int
    active_users: int
    price_per_user: int
    monthly_total: int


def _tenant_out(t: Tenant, active_users: int) -> TenantOut:
    price = settings.price_per_user
    return TenantOut(
        id=str(t.id), name=t.name, slug=t.slug, vertical=t.vertical,
        max_users=t.max_users, active_users=active_users,
        price_per_user=price, monthly_total=active_users * price,
    )


@router.get("/tenants", response_model=list[TenantOut])
async def list_tenants(ctx=Depends(get_admin_context)):
    # Admin session bypasses RLS, so count active users per tenant explicitly.
    active = func.count(User.id).filter(User.status == "active").label("active")
    rows = (await ctx["session"].execute(
        select(Tenant, active)
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(Tenant.name)
    )).all()
    return [_tenant_out(t, n or 0) for t, n in rows]


class CreateTenantIn(BaseModel):
    tenant_name: str
    slug: str
    vertical: str = "generic"
    max_users: int = 1
    owner_email: EmailStr
    owner_name: str | None = None
    owner_password: str


@router.post("/tenants", status_code=201, response_model=TenantOut)
async def create_tenant(body: CreateTenantIn, ctx=Depends(get_admin_context)):
    """Platform-admin-only: provision a new tenant with its owner user and the
    core modules enabled. This is the ONLY way accounts are created — there is
    no public self-signup (premium / invite-only product)."""
    session = ctx["session"]

    slug = body.slug.strip().lower()
    if not slug:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Workspace ID is required.")
    if len(body.owner_password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 6 characters.")

    exists = (await session.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none()
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Workspace ID already taken")

    tenant = Tenant(name=body.tenant_name.strip(), slug=slug, vertical=body.vertical,
                    max_users=max(1, body.max_users))
    session.add(tenant)
    await session.flush()

    session.add(User(
        tenant_id=tenant.id,
        email=str(body.owner_email).strip().lower(),
        full_name=(body.owner_name or "").strip() or None,
        password_hash=hash_password(body.owner_password),
        status="active",
        role="owner",               # full control of THEIR tenant
        is_platform_admin=False,    # never a platform admin → no /admin access
    ))

    core = (await session.execute(select(Module).where(Module.category == "core"))).scalars().all()
    for m in core:
        session.add(TenantModule(tenant_id=tenant.id, module_id=m.id, enabled=True))

    # The owner is the tenant's first active user → 1 seat.
    return _tenant_out(tenant, active_users=1)


class UpdateTenantIn(BaseModel):
    name: str | None = None
    max_users: int | None = None


@router.patch("/tenants/{tenant_id}", response_model=TenantOut)
async def update_tenant(tenant_id: str, body: UpdateTenantIn, ctx=Depends(get_admin_context)):
    session = ctx["session"]
    tenant = (await session.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found.")
    if body.name is not None:
        tenant.name = body.name.strip() or tenant.name
    if body.max_users is not None:
        if body.max_users < 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Seats must be at least 1.")
        tenant.max_users = body.max_users
    active = (await session.execute(
        select(func.count()).select_from(User)
        .where(User.tenant_id == tenant.id, User.status == "active")
    )).scalar() or 0
    return _tenant_out(tenant, active)


@router.get("/tenants/{tenant_id}/modules")
async def tenant_modules(tenant_id: str, ctx=Depends(get_admin_context)):
    # Single round trip: all modules LEFT JOIN this tenant's toggles.
    rows = (await ctx["session"].execute(
        select(Module, TenantModule.enabled)
        .outerjoin(TenantModule, and_(
            TenantModule.module_id == Module.id,
            TenantModule.tenant_id == tenant_id,
        ))
        .order_by(Module.category, Module.name)
    )).all()
    return [
        {"module_id": str(m.id), "code": m.code, "name": m.name,
         "category": m.category, "enabled": bool(enabled)}
        for m, enabled in rows
    ]


class ToggleIn(BaseModel):
    module_id: str
    enabled: bool


@router.put("/tenants/{tenant_id}/modules")
async def toggle_module(tenant_id: str, body: ToggleIn, ctx=Depends(get_admin_context)):
    session = ctx["session"]
    existing = (await session.execute(
        select(TenantModule).where(
            TenantModule.tenant_id == tenant_id, TenantModule.module_id == body.module_id
        )
    )).scalar_one_or_none()
    if existing:
        existing.enabled = body.enabled
    else:
        session.add(TenantModule(tenant_id=tenant_id, module_id=body.module_id, enabled=body.enabled))
    return {"ok": True}


@router.get("/tenants/{tenant_id}/field-definitions")
async def list_fields(tenant_id: str, entity: str, ctx=Depends(get_admin_context)):
    rows = (await ctx["session"].execute(
        select(FieldDefinition).where(
            FieldDefinition.tenant_id == tenant_id, FieldDefinition.entity == entity
        ).order_by(FieldDefinition.sort_order)
    )).scalars().all()
    return [{"id": str(d.id), "field_key": d.field_key, "label": d.label,
             "data_type": d.data_type, "is_required": d.is_required, "options": d.options} for d in rows]


class FieldIn(BaseModel):
    entity: str
    field_key: str
    label: str
    data_type: str
    is_required: bool = False
    options: list = []


@router.post("/tenants/{tenant_id}/field-definitions", status_code=201)
async def add_field(tenant_id: str, body: FieldIn, ctx=Depends(get_admin_context)):
    ctx["session"].add(FieldDefinition(
        tenant_id=tenant_id, entity=body.entity, field_key=body.field_key,
        label=body.label, data_type=body.data_type, is_required=body.is_required, options=body.options,
    ))
    return {"ok": True}