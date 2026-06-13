"""Batch expiry helpers shared by the pharmacy module and the POS scan path."""
from datetime import date

from sqlalchemy import select

from app.db.models import ProductBatch

NEAR_DAYS = 30   # warn when a batch expires within this many days


def batch_status(expiry: date | None, today: date | None = None) -> tuple[str, int | None]:
    """Return (status, days_to_expiry) for one batch."""
    if expiry is None:
        return "ok", None
    today = today or date.today()
    days = (expiry - today).days
    if days < 0:
        return "expired", days
    if days <= NEAR_DAYS:
        return "near", days
    return "ok", days


async def consume_batches_fefo(session, product_id, qty: float) -> None:
    """Deduct `qty` from a product's batches, earliest-expiry first (FEFO),
    skipping expired batches. No-op if the product isn't batch-tracked. Keeps
    batch quantities in step with sales so expiry status stays accurate."""
    if not qty or qty <= 0:
        return
    today = date.today()
    rows = (await session.execute(
        select(ProductBatch)
        .where(ProductBatch.product_id == product_id, ProductBatch.quantity > 0)
        .order_by(ProductBatch.expiry_date.asc().nullslast())
    )).scalars().all()
    remaining = float(qty)
    for b in rows:
        if remaining <= 0:
            break
        if b.expiry_date is not None and b.expiry_date < today:
            continue  # never sell expired stock
        take = min(remaining, float(b.quantity))
        b.quantity = round(float(b.quantity) - take, 3)
        remaining -= take


async def product_expiry_status(session, product_id) -> dict:
    """Roll batches up to a product-level sellability verdict for the POS."""
    rows = (await session.execute(
        select(ProductBatch).where(ProductBatch.product_id == product_id)
    )).scalars().all()
    if not rows:
        return {"has_batches": False, "status": "none", "sellable_qty": None, "nearest_expiry": None}

    today = date.today()
    sellable = sum(float(b.quantity) for b in rows
                   if float(b.quantity) > 0 and (b.expiry_date is None or b.expiry_date >= today))
    expired = sum(float(b.quantity) for b in rows
                  if float(b.quantity) > 0 and b.expiry_date is not None and b.expiry_date < today)
    future = [b.expiry_date for b in rows
              if float(b.quantity) > 0 and b.expiry_date is not None and b.expiry_date >= today]
    nearest = min(future) if future else None

    if sellable <= 0 and expired > 0:
        status = "expired"
    elif nearest is not None and (nearest - today).days <= NEAR_DAYS:
        status = "near"
    else:
        status = "ok"
    return {
        "has_batches": True, "status": status,
        "sellable_qty": round(sellable, 3),
        "nearest_expiry": nearest.isoformat() if nearest else None,
    }
