from datetime import datetime
from pydantic import BaseModel


class CategoryIn(BaseModel):
    name: str
    description: str | None = None


class CategoryOut(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class SupplierIn(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    contact_person: str | None = None
    notes: str | None = None
    status: str = "active"


class SupplierOut(BaseModel):
    id: str
    name: str
    email: str | None
    phone: str | None
    address: str | None
    contact_person: str | None
    notes: str | None
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class StockMovementIn(BaseModel):
    product_id: str
    movement_type: str
    quantity: float
    unit_cost: float | None = None
    reference: str | None = None
    notes: str | None = None


class StockMovementOut(BaseModel):
    id: str
    product_id: str
    product_name: str
    movement_type: str
    quantity: float
    unit_cost: float | None
    reference: str | None
    notes: str | None
    created_at: datetime
    model_config = {"from_attributes": True}
