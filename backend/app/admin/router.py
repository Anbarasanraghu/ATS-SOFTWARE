from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.auth.deps import get_admin_context
from app.db.models import FieldDefinition, Module, Tenant, TenantModule

router = APIRouter()


class TenantOut(BaseModel):
    id: str
    name: str
    slug: str
    vertical: str


@router.get("/tenants", response_model=list[TenantOut])
async def list_tenants(ctx=Depends(get_admin_context)):
    rows = (await ctx["session"].execute(select(Tenant))).scalars().all()
    return [TenantOut(id=str(t.id), name=t.name, slug=t.slug, vertical=t.vertical) for t in rows]


@router.get("/tenants/{tenant_id}/modules")
async def tenant_modules(tenant_id: str, ctx=Depends(get_admin_context)):
    session = ctx["session"]
    all_mods = (await session.execute(select(Module).order_by(Module.category, Module.name))).scalars().all()
    enabled = {
        str(tm.module_id): tm.enabled
        for tm in (await session.execute(
            select(TenantModule).where(TenantModule.tenant_id == tenant_id)
        )).scalars().all()
    }
    return [
        {"module_id": str(m.id), "code": m.code, "name": m.name,
         "category": m.category, "enabled": enabled.get(str(m.id), False)}
        for m in all_mods
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