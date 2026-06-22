import uuid
from pydantic import BaseModel, Field


class BarcodeIn(BaseModel):
    barcode: str | None = None          # blank → auto-generate
    barcode_type: str = "CODE128"       # EAN13|EAN8|UPCA|UPCE|CODE128|CODE39|QR
    kind: str = "alternate"             # secondary|supplier|internal|alternate


class BarcodeOut(BaseModel):
    id: str
    barcode: str
    barcode_type: str
    kind: str


class ProductIn(BaseModel):
    sku: str | None = None
    barcode: str | None = None
    barcode_type: str | None = None
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
    barcode_type: str | None = None
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
    # Pharmacy/batch expiry (populated on scan): none|ok|near|expired
    expiry_status: str | None = None
    nearest_expiry: str | None = None
    sellable_qty: float | None = None
