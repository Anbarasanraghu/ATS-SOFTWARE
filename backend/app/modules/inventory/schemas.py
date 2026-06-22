from datetime import date, datetime
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


class ActivityOut(BaseModel):
    id: str
    entity: str
    entity_id: str | None
    entity_name: str | None
    action: str
    detail: dict
    actor: str | None
    created_at: datetime


class DailyCount(BaseModel):
    day: str
    count: int


# ── Purchase / Sales documents ───────────────────────────────

class DocItemIn(BaseModel):
    product_id: str | None = None
    description: str
    quantity: float = 1
    unit_price: float = 0
    tax_percent: float = 0


class DocItemOut(BaseModel):
    id: str
    product_id: str | None
    description: str
    quantity: float
    unit_price: float
    tax_percent: float
    line_total: float


class DocIn(BaseModel):
    doc_type: str          # 'purchase' | 'sale'
    doc_number: str | None = None
    party_id: str | None = None
    party_name: str | None = None
    doc_date: date | None = None
    notes: str | None = None
    items: list[DocItemIn]
    update_cost: bool = True   # purchases: update product cost_price from unit_price


class DocOut(BaseModel):
    id: str
    doc_type: str
    doc_number: str | None
    party_id: str | None
    party_name: str | None
    doc_date: date
    status: str
    subtotal: float
    tax_total: float
    total: float
    notes: str | None
    created_at: datetime
    items: list[DocItemOut] = []


# ── Inventory reports ────────────────────────────────────────

class LowStockItem(BaseModel):
    id: str
    name: str
    sku: str | None
    stock_qty: float
    reorder_level: float
    unit: str


class InventorySummary(BaseModel):
    item_count: int
    total_stock_units: float
    stock_value_cost: float
    stock_value_retail: float
    low_stock_count: int
    low_stock_items: list[LowStockItem]
    purchases_total: float
    sales_total: float
    purchases_today: float
    sales_today: float


class PeriodStat(BaseModel):
    period: str
    stock_in: float
    stock_out: float
    purchases: float
    sales: float
