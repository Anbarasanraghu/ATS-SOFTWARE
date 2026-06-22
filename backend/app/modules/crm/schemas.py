from datetime import date, datetime
from pydantic import BaseModel


class CustomerIn(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    company: str | None = None
    address: str | None = None
    notes: str | None = None
    status: str = "active"
    crm_status: str = "new_lead"
    priority: str = "medium"
    source: str | None = None
    interested_service: str | None = None
    requirement_details: str | None = None
    assigned_staff: str | None = None
    first_followup_date: date | None = None
    first_followup_time: str | None = None
    last_followup_date: date | None = None
    next_followup_date: date | None = None
    tags: list[str] = []
    payment_status: str | None = None
    custom_fields: dict = {}


class CustomerOut(BaseModel):
    id: str
    name: str
    email: str | None
    phone: str | None
    whatsapp: str | None
    company: str | None
    address: str | None
    notes: str | None
    status: str
    crm_status: str
    priority: str
    source: str | None
    interested_service: str | None
    requirement_details: str | None
    assigned_staff: str | None
    first_followup_date: date | None
    first_followup_time: str | None
    last_followup_date: date | None
    next_followup_date: date | None
    tags: list[str]
    payment_status: str | None
    custom_fields: dict
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
