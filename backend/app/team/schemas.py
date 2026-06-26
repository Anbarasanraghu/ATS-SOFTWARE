from pydantic import BaseModel, EmailStr


class TeamUserOut(BaseModel):
    id: str
    email: str
    full_name: str | None
    role: str
    status: str
    is_owner: bool
    modules: list[str]   # assigned module codes (all tenant modules for owner/admin)


class CreateUserIn(BaseModel):
    email: EmailStr
    full_name: str | None = None
    password: str
    role: str = "member"          # member | manager | admin
    modules: list[str] = []       # module codes to grant


class UpdateUserIn(BaseModel):
    full_name: str | None = None
    role: str | None = None
    status: str | None = None     # active | disabled
    password: str | None = None
    modules: list[str] | None = None   # replaces the user's module grants


class SeatsOut(BaseModel):
    max_users: int
    active_users: int
    available: int
    price_per_user: int
    monthly_total: int
    can_add: bool


class TeamModuleOut(BaseModel):
    module_id: str
    code: str
    name: str
