from datetime import datetime
from pydantic import BaseModel


class CustomerIn(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    address: str | None = None
    notes: str | None = None
    status: str = "active"
    custom_fields: dict = {}


class CustomerOut(BaseModel):
    id: str
    name: str
    email: str | None
    phone: str | None
    company: str | None
    address: str | None
    notes: str | None
    status: str
    custom_fields: dict
    created_at: datetime

    model_config = {"from_attributes": True}
