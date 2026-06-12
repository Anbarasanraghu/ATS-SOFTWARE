from datetime import date, datetime
from pydantic import BaseModel


class BatchIn(BaseModel):
    product_id: str
    batch_no: str | None = None
    mfg_date: date | None = None
    expiry_date: date | None = None
    quantity: float = 0


class BatchOut(BaseModel):
    id: str
    product_id: str
    product_name: str
    batch_no: str | None
    mfg_date: date | None
    expiry_date: date | None
    quantity: float
    status: str               # ok | near | expired
    days_to_expiry: int | None
    created_at: datetime
