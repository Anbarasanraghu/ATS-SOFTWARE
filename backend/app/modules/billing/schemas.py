from __future__ import annotations
from datetime import date, datetime
from pydantic import BaseModel


class InvoiceItemIn(BaseModel):
    product_id: str | None = None
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0
    tax_percent: float = 0.0


class InvoiceItemOut(BaseModel):
    id: str
    product_id: str | None
    description: str
    quantity: float
    unit_price: float
    tax_percent: float
    line_total: float


class InvoiceIn(BaseModel):
    customer_id: str | None = None
    customer_name: str
    customer_email: str | None = None
    issue_date: date
    due_date: date | None = None
    notes: str | None = None
    items: list[InvoiceItemIn] = []


class InvoiceOut(BaseModel):
    id: str
    customer_id: str | None
    invoice_number: str
    customer_name: str
    customer_email: str | None
    issue_date: date
    due_date: date | None
    status: str
    notes: str | None
    subtotal: float
    tax_total: float
    total: float
    amount_paid: float
    balance_due: float
    items: list[InvoiceItemOut] = []
    payments: list[PaymentOut] = []


class StatusIn(BaseModel):
    status: str


class PaymentIn(BaseModel):
    amount: float
    payment_date: date
    method: str = "cash"
    reference: str | None = None
    notes: str | None = None


class PaymentOut(BaseModel):
    id: str
    invoice_id: str
    amount: float
    payment_date: date
    method: str
    reference: str | None
    notes: str | None
    created_at: datetime
