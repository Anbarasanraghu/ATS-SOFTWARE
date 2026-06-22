from datetime import date, datetime
from pydantic import BaseModel


class BatchIn(BaseModel):
    product_id: str
    batch_no: str | None = None
    mfg_date: date | None = None
    expiry_date: date | None = None
    quantity: float = 0
    mrp: float | None = None
    manufacturer: str | None = None


class BatchOut(BaseModel):
    id: str
    product_id: str
    product_name: str
    batch_no: str | None
    mfg_date: date | None
    expiry_date: date | None
    quantity: float
    mrp: float | None
    manufacturer: str | None
    status: str               # ok | near | expired
    days_to_expiry: int | None
    created_at: datetime


class BatchSummary(BaseModel):
    batches: int
    sellable_units: float
    near_count: int
    expired_count: int
    expired_units: float
    stock_value: float        # sum(quantity * mrp) for sellable batches
