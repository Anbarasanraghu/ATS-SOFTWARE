import uuid
from pydantic import BaseModel, Field


class ProductIn(BaseModel):
    sku: str | None = None
    barcode: str | None = None
    name: str
    description: str | None = None
    unit: str = "pcs"
    price: float = 0
    cost_price: float = 0
    tax_percent: float = 0
    stock_qty: float = 0
    reorder_level: float = 0
    category_id: str | None = None
    supplier_id: str | None = None
    custom_fields: dict = Field(default_factory=dict)


class ProductPatch(BaseModel):
    """Partial update for inline cell editing — only sent fields are changed."""
    sku: str | None = None
    barcode: str | None = None
    name: str | None = None
    description: str | None = None
    unit: str | None = None
    price: float | None = None
    cost_price: float | None = None
    tax_percent: float | None = None
    stock_qty: float | None = None
    reorder_level: float | None = None
    category_id: str | None = None
    supplier_id: str | None = None
    custom_fields: dict | None = None
    model_config = {"extra": "ignore"}


class BulkDeleteIn(BaseModel):
    ids: list[str]


class ProductOut(BaseModel):
    id: uuid.UUID
    sku: str | None
    barcode: str | None
    name: str
    unit: str
    price: float
    cost_price: float
    tax_percent: float
    stock_qty: float
    reorder_level: float
    is_low_stock: bool
    category_id: str | None
    supplier_id: str | None
    custom_fields: dict
