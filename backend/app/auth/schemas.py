from pydantic import BaseModel, EmailStr


class LoginIn(BaseModel):
    tenant_slug: str
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterTenantIn(BaseModel):
    tenant_name: str
    slug: str
    vertical: str = "generic"
    admin_email: EmailStr
    admin_name: str | None = None
    admin_password: str