from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.auth.deps import get_request_context
from app.db.models import Invoice, InvoiceItem, Payment
from app.modules.billing.schemas import (
    InvoiceIn, InvoiceItemOut, InvoiceOut,
    PaymentIn, PaymentOut, StatusIn,
)

router = APIRouter()

VALID_STATUSES = {"draft", "sent", "paid", "void"}


def _pmt_out(p: Payment) -> PaymentOut:
    return PaymentOut(
        id=str(p.id), invoice_id=str(p.invoice_id),
        amount=float(p.amount), payment_date=p.payment_date,
        method=p.method, reference=p.reference,
        notes=p.notes, created_at=p.created_at,
    )


def _item_out(item: InvoiceItem) -> InvoiceItemOut:
    return InvoiceItemOut(
        id=str(item.id),
        product_id=str(item.product_id) if item.product_id else None,
        description=item.description,
        quantity=float(item.quantity),
        unit_price=float(item.unit_price),
        tax_percent=float(item.tax_percent),
        line_total=float(item.line_total),
    )


def _inv_out(inv: Invoice, items: list[InvoiceItem] | None = None, payments: list[Payment] | None = None) -> InvoiceOut:
    amount_paid = float(inv.amount_paid or 0)
    return InvoiceOut(
        id=str(inv.id),
        customer_id=str(inv.customer_id) if inv.customer_id else None,
        invoice_number=inv.invoice_number,
        customer_name=inv.customer_name,
        customer_email=inv.customer_email,
        issue_date=inv.issue_date,
        due_date=inv.due_date,
        status=inv.status,
        notes=inv.notes,
        subtotal=float(inv.subtotal),
        tax_total=float(inv.tax_total),
        total=float(inv.total),
        amount_paid=amount_paid,
        balance_due=round(float(inv.total) - amount_paid, 2),
        items=[_item_out(i) for i in (items or [])],
        payments=[_pmt_out(p) for p in (payments or [])],
    )


async def _load_inv(session, invoice_id: str) -> tuple[Invoice, list[InvoiceItem], list[Payment]]:
    inv = (await session.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    items = (await session.execute(
        select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id)
    )).scalars().all()
    payments = (await session.execute(
        select(Payment).where(Payment.invoice_id == invoice_id).order_by(Payment.payment_date)
    )).scalars().all()
    return inv, list(items), list(payments)


@router.get("", response_model=list[InvoiceOut])
async def list_invoices(ctx=Depends(get_request_context)):
    session = ctx["session"]
    rows = (await session.execute(
        select(Invoice).order_by(Invoice.created_at.desc())
    )).scalars().all()
    return [_inv_out(inv) for inv in rows]


@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(invoice_id: str, ctx=Depends(get_request_context)):
    inv, items, payments = await _load_inv(ctx["session"], invoice_id)
    return _inv_out(inv, items, payments)


@router.post("", response_model=InvoiceOut, status_code=201)
async def create_invoice(body: InvoiceIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]

    count = (await session.execute(
        select(func.count(Invoice.id)).select_from(Invoice)
    )).scalar_one()
    invoice_number = f"INV-{count + 1:04d}"

    subtotal = sum(i.quantity * i.unit_price for i in body.items)
    tax_total = sum(i.quantity * i.unit_price * i.tax_percent / 100 for i in body.items)

    inv = Invoice(
        tenant_id=user.tenant_id,
        customer_id=body.customer_id or None,
        invoice_number=invoice_number,
        customer_name=body.customer_name,
        customer_email=body.customer_email,
        issue_date=body.issue_date,
        due_date=body.due_date,
        notes=body.notes,
        subtotal=subtotal,
        tax_total=tax_total,
        total=subtotal + tax_total,
        amount_paid=0,
        created_by=user.id,
    )
    session.add(inv)
    await session.flush()

    saved_items: list[InvoiceItem] = []
    for item_data in body.items:
        item = InvoiceItem(
            invoice_id=inv.id,
            tenant_id=user.tenant_id,
            product_id=item_data.product_id or None,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            tax_percent=item_data.tax_percent,
            line_total=item_data.quantity * item_data.unit_price,
        )
        session.add(item)
        saved_items.append(item)

    await session.flush()
    return _inv_out(inv, saved_items, [])


@router.patch("/{invoice_id}/status", response_model=InvoiceOut)
async def update_status(invoice_id: str, body: StatusIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    if body.status not in VALID_STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"status must be one of {VALID_STATUSES}")
    inv, items, payments = await _load_inv(session, invoice_id)
    inv.status = body.status
    return _inv_out(inv, items, payments)


@router.post("/{invoice_id}/payments", response_model=PaymentOut, status_code=201)
async def record_payment(invoice_id: str, body: PaymentIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    inv = (await session.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    if inv.status == "void":
        raise HTTPException(status.HTTP_409_CONFLICT, "Cannot record payment on a void invoice")

    balance = float(inv.total) - float(inv.amount_paid or 0)
    if body.amount > balance + 0.001:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"Payment ({body.amount}) exceeds balance due ({balance:.2f})")

    pmt = Payment(
        tenant_id=user.tenant_id,
        invoice_id=inv.id,
        amount=body.amount,
        payment_date=body.payment_date,
        method=body.method,
        reference=body.reference,
        notes=body.notes,
        created_by=user.id,
    )
    session.add(pmt)

    inv.amount_paid = float(inv.amount_paid or 0) + body.amount
    if float(inv.amount_paid) >= float(inv.total) - 0.001:
        inv.status = "paid"
    elif inv.status == "draft":
        inv.status = "sent"

    await session.flush()
    return _pmt_out(pmt)


@router.delete("/{invoice_id}/payments/{payment_id}", status_code=204)
async def delete_payment(invoice_id: str, payment_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    pmt = (await session.execute(
        select(Payment).where(Payment.id == payment_id, Payment.invoice_id == invoice_id)
    )).scalar_one_or_none()
    if not pmt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    inv = (await session.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one()
    inv.amount_paid = max(0.0, float(inv.amount_paid or 0) - float(pmt.amount))
    if inv.status == "paid":
        inv.status = "sent"
    await session.delete(pmt)


@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(invoice_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    inv = (await session.execute(select(Invoice).where(Invoice.id == invoice_id))).scalar_one_or_none()
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    if inv.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only draft invoices can be deleted")
    await session.delete(inv)
