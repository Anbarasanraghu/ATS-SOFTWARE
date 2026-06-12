"""Pharmacy module — batch & expiry tracking.

Adding a batch is a stock-in (increments the product and logs a movement).
Deleting a batch reverses that stock. An expiry report surfaces what's
expired or expiring soon.
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.auth.deps import get_request_context
from app.db.models import Product, ProductBatch, StockMovement
from app.modules.inventory.activity import log_activity
from app.modules.pharmacy.expiry import batch_status
from app.modules.pharmacy.schemas import BatchIn, BatchOut

router = APIRouter()


def _out(b: ProductBatch, name: str) -> BatchOut:
    st, days = batch_status(b.expiry_date)
    return BatchOut(
        id=str(b.id), product_id=str(b.product_id), product_name=name,
        batch_no=b.batch_no, mfg_date=b.mfg_date, expiry_date=b.expiry_date,
        quantity=float(b.quantity), status=st, days_to_expiry=days, created_at=b.created_at,
    )


@router.get("/batches", response_model=list[BatchOut])
async def list_batches(product_id: str | None = None, ctx=Depends(get_request_context)):
    session = ctx["session"]
    q = select(ProductBatch, Product.name).join(Product, ProductBatch.product_id == Product.id, isouter=True)
    if product_id:
        q = q.where(ProductBatch.product_id == product_id)
    q = q.order_by(ProductBatch.expiry_date.asc().nullslast())
    rows = (await session.execute(q)).all()
    return [_out(b, name or "Unknown") for b, name in rows]


@router.post("/batches", response_model=BatchOut, status_code=201)
async def add_batch(body: BatchIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    p = (await session.execute(select(Product).where(Product.id == body.product_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    b = ProductBatch(
        tenant_id=user.tenant_id, product_id=p.id, batch_no=body.batch_no,
        mfg_date=body.mfg_date, expiry_date=body.expiry_date,
        quantity=body.quantity, created_by=user.id,
    )
    session.add(b)
    # A new batch is received stock.
    if body.quantity:
        p.stock_qty = float(p.stock_qty) + float(body.quantity)
        session.add(StockMovement(
            tenant_id=user.tenant_id, product_id=p.id, movement_type="in",
            quantity=body.quantity, reference=body.batch_no, notes="Batch received", created_by=user.id,
        ))
    await session.flush()
    await log_activity(session, user, entity="stock", action="in",
                       entity_id=p.id, entity_name=p.name,
                       detail={"quantity": float(body.quantity), "new_stock": float(p.stock_qty),
                               "reference": f"Batch {body.batch_no or ''}".strip()})
    return _out(b, p.name)


@router.delete("/batches/{batch_id}", status_code=204)
async def delete_batch(batch_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    b = (await session.execute(select(ProductBatch).where(ProductBatch.id == batch_id))).scalar_one_or_none()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Batch not found")
    p = (await session.execute(select(Product).where(Product.id == b.product_id))).scalar_one_or_none()
    if p and float(b.quantity):
        p.stock_qty = max(0.0, float(p.stock_qty) - float(b.quantity))
    await session.delete(b)


@router.get("/expiry", response_model=list[BatchOut])
async def expiry_report(days: int = 90, ctx=Depends(get_request_context)):
    """Batches already expired or expiring within `days` (quantity > 0)."""
    session = ctx["session"]
    cutoff = (datetime.now(timezone.utc) + timedelta(days=days)).date()
    rows = (await session.execute(
        select(ProductBatch, Product.name)
        .join(Product, ProductBatch.product_id == Product.id, isouter=True)
        .where(ProductBatch.expiry_date.is_not(None),
               ProductBatch.expiry_date <= cutoff,
               ProductBatch.quantity > 0)
        .order_by(ProductBatch.expiry_date.asc())
    )).all()
    return [_out(b, name or "Unknown") for b, name in rows]
