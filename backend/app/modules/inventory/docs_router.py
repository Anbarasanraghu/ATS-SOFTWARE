"""Purchase & Sales entry documents, plus inventory reports.

Creating a document posts it immediately: each line adjusts the product's
stock (purchase = in, sale = out) and writes a linked stock_movement.
Deleting a posted document reverses the stock and removes its movements
(via the doc_id cascade).
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, case, func, select

from app.auth.deps import get_request_context
from app.db.models import InventoryDoc, InventoryDocItem, Product, StockMovement
from app.modules.inventory.activity import log_activity
from app.modules.inventory.schemas import (
    DocIn, DocItemOut, DocOut, InventorySummary, LowStockItem, PeriodStat,
)

router = APIRouter()


def _doc_out(d: InventoryDoc, items: list[InventoryDocItem]) -> DocOut:
    return DocOut(
        id=str(d.id), doc_type=d.doc_type, doc_number=d.doc_number,
        party_id=str(d.party_id) if d.party_id else None, party_name=d.party_name,
        doc_date=d.doc_date, status=d.status,
        subtotal=float(d.subtotal), tax_total=float(d.tax_total), total=float(d.total),
        notes=d.notes, created_at=d.created_at,
        items=[
            DocItemOut(
                id=str(i.id), product_id=str(i.product_id) if i.product_id else None,
                description=i.description, quantity=float(i.quantity),
                unit_price=float(i.unit_price), tax_percent=float(i.tax_percent),
                line_total=float(i.line_total),
            ) for i in items
        ],
    )


@router.get("/documents", response_model=list[DocOut])
async def list_documents(doc_type: str | None = None, ctx=Depends(get_request_context)):
    session = ctx["session"]
    q = select(InventoryDoc)
    if doc_type:
        q = q.where(InventoryDoc.doc_type == doc_type)
    q = q.order_by(InventoryDoc.doc_date.desc(), InventoryDoc.created_at.desc()).limit(300)
    docs = (await session.execute(q)).scalars().all()
    return [_doc_out(d, []) for d in docs]


@router.get("/documents/{doc_id}", response_model=DocOut)
async def get_document(doc_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    d = (await session.execute(select(InventoryDoc).where(InventoryDoc.id == doc_id))).scalar_one_or_none()
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    items = (await session.execute(
        select(InventoryDocItem).where(InventoryDocItem.doc_id == d.id)
    )).scalars().all()
    return _doc_out(d, list(items))


@router.post("/documents", response_model=DocOut, status_code=201)
async def create_document(body: DocIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    if body.doc_type not in ("purchase", "sale"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "doc_type must be 'purchase' or 'sale'")
    if not body.items:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "At least one line item is required")

    # Pre-load referenced products and validate sale stock up front.
    product_ids = [it.product_id for it in body.items if it.product_id]
    products: dict[str, Product] = {}
    if product_ids:
        rows = (await session.execute(select(Product).where(Product.id.in_(product_ids)))).scalars().all()
        products = {str(p.id): p for p in rows}

    if body.doc_type == "sale":
        need: dict[str, float] = {}
        for it in body.items:
            if it.product_id:
                need[it.product_id] = need.get(it.product_id, 0) + it.quantity
        for pid, qty in need.items():
            p = products.get(pid)
            if p and float(p.stock_qty) < qty:
                raise HTTPException(status.HTTP_409_CONFLICT, f"Insufficient stock for '{p.name}'")

    subtotal = tax_total = 0.0
    doc = InventoryDoc(
        tenant_id=user.tenant_id, doc_type=body.doc_type, doc_number=body.doc_number,
        party_id=body.party_id or None, party_name=body.party_name,
        doc_date=body.doc_date or date.today(), status="posted",
        notes=body.notes, created_by=user.id,
    )
    session.add(doc)
    await session.flush()

    for it in body.items:
        line = round(it.quantity * it.unit_price, 2)
        tax = round(line * it.tax_percent / 100, 2)
        subtotal += line
        tax_total += tax
        session.add(InventoryDocItem(
            doc_id=doc.id, tenant_id=user.tenant_id, product_id=it.product_id or None,
            description=it.description, quantity=it.quantity, unit_price=it.unit_price,
            tax_percent=it.tax_percent, line_total=line,
        ))

        p = products.get(it.product_id) if it.product_id else None
        if p:
            if body.doc_type == "purchase":
                p.stock_qty = float(p.stock_qty) + it.quantity
                if body.update_cost and it.unit_price:
                    p.cost_price = it.unit_price
                mtype = "in"
            else:
                p.stock_qty = float(p.stock_qty) - it.quantity
                mtype = "out"
            session.add(StockMovement(
                tenant_id=user.tenant_id, product_id=p.id, movement_type=mtype,
                quantity=it.quantity, unit_cost=it.unit_price,
                reference=body.doc_number, doc_id=doc.id, created_by=user.id,
            ))

    doc.subtotal = round(subtotal, 2)
    doc.tax_total = round(tax_total, 2)
    doc.total = round(subtotal + tax_total, 2)
    await session.flush()

    await log_activity(
        session, user, entity=body.doc_type, action="create",
        entity_id=doc.id, entity_name=body.party_name or (body.doc_number or body.doc_type),
        detail={"total": doc.total, "items": len(body.items)},
    )

    items = (await session.execute(
        select(InventoryDocItem).where(InventoryDocItem.doc_id == doc.id)
    )).scalars().all()
    return _doc_out(doc, list(items))


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: str, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    d = (await session.execute(select(InventoryDoc).where(InventoryDoc.id == doc_id))).scalar_one_or_none()
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")

    items = (await session.execute(
        select(InventoryDocItem).where(InventoryDocItem.doc_id == d.id)
    )).scalars().all()

    # Reverse the stock effect before deleting (movements cascade via doc_id).
    if d.status == "posted":
        for it in items:
            if not it.product_id:
                continue
            p = (await session.execute(select(Product).where(Product.id == it.product_id))).scalar_one_or_none()
            if not p:
                continue
            if d.doc_type == "purchase":
                p.stock_qty = float(p.stock_qty) - float(it.quantity)
            else:
                p.stock_qty = float(p.stock_qty) + float(it.quantity)

    await log_activity(
        session, user, entity=d.doc_type, action="delete",
        entity_id=d.id, entity_name=d.party_name or (d.doc_number or d.doc_type),
    )
    await session.delete(d)


# ── Inventory reports ────────────────────────────────────────

@router.get("/reports/summary", response_model=InventorySummary)
async def reports_summary(ctx=Depends(get_request_context)):
    session = ctx["session"]
    products = (await session.execute(select(Product))).scalars().all()

    item_count = len(products)
    total_units = sum(float(p.stock_qty) for p in products)
    value_cost = sum(float(p.stock_qty) * float(p.cost_price or 0) for p in products)
    value_retail = sum(float(p.stock_qty) * float(p.price or 0) for p in products)
    low = [
        p for p in products
        if float(p.reorder_level or 0) > 0 and float(p.stock_qty) <= float(p.reorder_level)
    ]
    low_items = [
        LowStockItem(id=str(p.id), name=p.name, sku=p.sku, stock_qty=float(p.stock_qty),
                     reorder_level=float(p.reorder_level or 0), unit=p.unit)
        for p in sorted(low, key=lambda x: float(x.stock_qty))[:50]
    ]

    # All four money totals in a single round trip via conditional aggregation.
    today = date.today()
    is_purchase = InventoryDoc.doc_type == "purchase"
    is_sale = InventoryDoc.doc_type == "sale"
    is_today = InventoryDoc.doc_date >= today
    t = (await session.execute(select(
        func.coalesce(func.sum(case((is_purchase, InventoryDoc.total), else_=0)), 0),
        func.coalesce(func.sum(case((is_sale, InventoryDoc.total), else_=0)), 0),
        func.coalesce(func.sum(case((and_(is_purchase, is_today), InventoryDoc.total), else_=0)), 0),
        func.coalesce(func.sum(case((and_(is_sale, is_today), InventoryDoc.total), else_=0)), 0),
    ))).one()

    return InventorySummary(
        item_count=item_count, total_stock_units=round(total_units, 3),
        stock_value_cost=round(value_cost, 2), stock_value_retail=round(value_retail, 2),
        low_stock_count=len(low), low_stock_items=low_items,
        purchases_total=float(t[0]), sales_total=float(t[1]),
        purchases_today=float(t[2]), sales_today=float(t[3]),
    )


@router.get("/reports/by-period", response_model=list[PeriodStat])
async def reports_by_period(period: str = "daily", ctx=Depends(get_request_context)):
    """Stock in/out (units) and purchase/sale value grouped by day or month."""
    session = ctx["session"]
    if period == "monthly":
        fmt, cutoff = "YYYY-MM", datetime.now(timezone.utc) - timedelta(days=365)
    else:
        fmt, cutoff = "YYYY-MM-DD", datetime.now(timezone.utc) - timedelta(days=30)

    mv_period = func.to_char(StockMovement.created_at, fmt)
    mv_rows = (await session.execute(
        select(
            mv_period.label("period"),
            func.coalesce(func.sum(case(
                (StockMovement.movement_type.in_(("in", "return")), StockMovement.quantity), else_=0)), 0).label("stock_in"),
            func.coalesce(func.sum(case(
                (StockMovement.movement_type == "out", StockMovement.quantity), else_=0)), 0).label("stock_out"),
        ).where(StockMovement.created_at >= cutoff).group_by(mv_period)
    )).all()

    doc_period = func.to_char(InventoryDoc.doc_date, fmt)
    doc_rows = (await session.execute(
        select(
            doc_period.label("period"),
            func.coalesce(func.sum(case(
                (InventoryDoc.doc_type == "purchase", InventoryDoc.total), else_=0)), 0).label("purchases"),
            func.coalesce(func.sum(case(
                (InventoryDoc.doc_type == "sale", InventoryDoc.total), else_=0)), 0).label("sales"),
        ).where(InventoryDoc.doc_date >= cutoff.date()).group_by(doc_period)
    )).all()

    merged: dict[str, dict] = {}
    for r in mv_rows:
        merged[r.period] = {"stock_in": float(r.stock_in), "stock_out": float(r.stock_out), "purchases": 0.0, "sales": 0.0}
    for r in doc_rows:
        m = merged.setdefault(r.period, {"stock_in": 0.0, "stock_out": 0.0, "purchases": 0.0, "sales": 0.0})
        m["purchases"] = float(r.purchases)
        m["sales"] = float(r.sales)

    return [
        PeriodStat(period=k, stock_in=v["stock_in"], stock_out=v["stock_out"],
                   purchases=v["purchases"], sales=v["sales"])
        for k, v in sorted(merged.items())
    ]
