from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.auth.deps import get_request_context
from app.auth.schemas import LoginIn, RegisterTenantIn, TokenOut
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import Module, Tenant, TenantModule, User
from app.db.session import SessionLocal, set_tenant_context

router = APIRouter()


@router.post("/register-tenant", status_code=201)
async def register_tenant(body: RegisterTenantIn):
    async with SessionLocal() as session:
        async with session.begin():
            exists = (
                await session.execute(select(Tenant).where(Tenant.slug == body.slug))
            ).scalar_one_or_none()
            if exists:
                raise HTTPException(status.HTTP_409_CONFLICT, "Slug already taken")

            tenant = Tenant(name=body.tenant_name, slug=body.slug, vertical=body.vertical)
            session.add(tenant)
            await session.flush()  # assigns tenant.id

            await set_tenant_context(session, tenant.id)

            session.add(
                User(
                    tenant_id=tenant.id,
                    email=body.admin_email,
                    full_name=body.admin_name,
                    password_hash=hash_password(body.admin_password),
                    status="active",
                )
            )

            # Enable the core modules for the new tenant.
            core = (
                await session.execute(select(Module).where(Module.category == "core"))
            ).scalars().all()
            for m in core:
                session.add(TenantModule(tenant_id=tenant.id, module_id=m.id, enabled=True))

    return {"tenant_slug": body.slug, "message": "Tenant created. You can now log in."}


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn):
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

            token = create_access_token(user_id=user.id, tenant_id=tenant.id)

    return TokenOut(access_token=token)



@router.get("/me")
async def me(ctx=Depends(get_request_context)):
    

    session = ctx["session"]
    user = ctx["user"]

    tenant = (
        await session.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    ).scalar_one()

    module_codes = (
        await session.execute(
            select(Module.code)
            .join(TenantModule, TenantModule.module_id == Module.id)
            .where(TenantModule.enabled.is_(True))
        )
    ).scalars().all()

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_platform_admin": user.is_platform_admin,
        },
        "tenant": {"slug": tenant.slug, "name": tenant.name, "vertical": tenant.vertical},
        "modules": list(module_codes),
    }