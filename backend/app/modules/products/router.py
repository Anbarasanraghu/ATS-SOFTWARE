import random
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.auth.deps import get_request_context
from app.db.models import Product, ProductBarcode
from app.modules.custom_fields import validate_custom_fields
from app.modules.inventory.activity import diff_fields, log_activity
from app.modules.products.schemas import (
    BarcodeIn, BarcodeOut, BulkDeleteIn, ProductIn, ProductOut, ProductPatch,
)

router = APIRouter()


def _jsonable(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, uuid.UUID):
        return str(v)
    return v


def _to_out(p: Product) -> ProductOut:
    reorder = float(p.reorder_level or 0)
    return ProductOut(
        id=p.id, sku=p.sku, barcode=p.barcode, barcode_type=p.barcode_type, name=p.name, unit=p.unit,
        price=float(p.price), cost_price=float(p.cost_price or 0),
        tax_percent=float(p.tax_percent), stock_qty=float(p.stock_qty),
        reorder_level=reorder,
        is_low_stock=float(p.stock_qty) <= reorder and reorder > 0,
        category_id=str(p.category_id) if p.category_id else None,
        supplier_id=str(p.supplier_id) if p.supplier_id else None,
        custom_fields=p.custom_fields or {},
    )


def _ean13(prefix: str = "200") -> str:
    base = prefix + "".join(str(random.randint(0, 9)) for _ in range(12 - len(prefix)))
    s = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(base))
    return base + str((10 - (s % 10)) % 10)


async def _barcode_in_use(session, code: str) -> bool:
    """A code is taken if it's any product's primary barcode/SKU or an alternate."""
    hit = (await session.execute(
        select(Product.id).where(or_(Product.barcode == code, Product.sku == code)).limit(1)
    )).first()
    if hit:
        return True
    return (await session.execute(
        select(ProductBarcode.id).where(ProductBarcode.barcode == code).limit(1)
    )).first() is not None


# ── Barcode / SKU scan lookup — must be before /{product_id} ──

@router.get("/scan", response_model=ProductOut)
async def scan_product(code: str, ctx=Depends(get_request_context)):
    """Resolve ANY barcode (primary, alternate, supplier, internal) or SKU to a
    product — used by POS and every inventory scan flow."""
    session = ctx["session"]
    alt = select(ProductBarcode.product_id).where(ProductBarcode.barcode == code)
    p = (await session.execute(
        select(Product)
        .where(or_(Product.barcode == code, Product.sku == code, Product.id.in_(alt)))
        .order_by((Product.barcode == code).desc())
        .limit(1)
    )).scalars().first()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No product found for code '{code}'")
    out = _to_out(p)
    # Attach batch-expiry verdict so the POS can block expired / warn near-expiry.
    from app.modules.pharmacy.expiry import product_expiry_status
    exp = await product_expiry_status(session, p.id)
    out.expiry_status = exp["status"]
    out.nearest_expiry = exp["nearest_expiry"]
    out.sellable_qty = exp["sellable_qty"]
    return out


# ── Multiple barcodes per product ────────────────────────────

@router.get("/{product_id}/barcodes", response_model=list[BarcodeOut])
async def list_barcodes(product_id: str, ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(ProductBarcode).where(ProductBarcode.product_id == product_id).order_by(ProductBarcode.created_at)
    )).scalars().all()
    return [BarcodeOut(id=str(b.id), barcode=b.barcode, barcode_type=b.barcode_type, kind=b.kind) for b in rows]


@router.post("/{product_id}/barcodes", response_model=BarcodeOut, status_code=201)
async def add_barcode(product_id: str, body: BarcodeIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    p = (await session.execute(select(Product).where(Product.id == product_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    code = (body.barcode or "").strip()
    if not code:
        # Auto-generate: internal codes look like INV000123, others are EAN-13.
        for _ in range(50):
            cand = f"INV{random.randint(0, 999999):06d}" if body.kind == "internal" else _ean13()
            if not await _barcode_in_use(session, cand):
                code = cand
                break
        if not code:
            raise HTTPException(status.HTTP_409_CONFLICT, "Could not generate a unique barcode")
    elif await _barcode_in_use(session, code):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Barcode '{code}' is already in use")

    b = ProductBarcode(tenant_id=user.tenant_id, product_id=p.id, barcode=code,
                       barcode_type=body.barcode_type or "CODE128", kind=body.kind or "alternate")
    session.add(b)
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Barcode '{code}' is already in use")
    await log_activity(session, user, entity="product", action="update",
                       entity_id=p.id, entity_name=p.name, detail={"added_barcode": code})
    return BarcodeOut(id=str(b.id), barcode=b.barcode, barcode_type=b.barcode_type, kind=b.kind)


@router.delete("/barcodes/{barcode_id}", status_code=204)
async def delete_barcode(barcode_id: str, ctx=Depends(get_request_context)):
    session = ctx["session"]
    b = (await session.execute(select(ProductBarcode).where(ProductBarcode.id == barcode_id))).scalar_one_or_none()
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Barcode not found")
    await session.delete(b)


@router.get("", response_model=list[ProductOut])
async def list_products(ctx=Depends(get_request_context)):
    rows = (await ctx["session"].execute(
        select(Product).order_by(Product.created_at.desc())
    )).scalars().all()
    return [_to_out(p) for p in rows]


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, ctx=Depends(get_request_context)):
    p = (await ctx["session"].execute(
        select(Product).where(Product.id == product_id)
    )).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return _to_out(p)


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(body: ProductIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    clean = await validate_custom_fields(session, "product", body.custom_fields)
    p = Product(
        tenant_id=user.tenant_id, sku=body.sku, barcode=body.barcode, barcode_type=body.barcode_type,
        name=body.name, description=body.description, unit=body.unit,
        price=body.price, cost_price=body.cost_price,
        tax_percent=body.tax_percent, stock_qty=body.stock_qty,
        reorder_level=body.reorder_level,
        category_id=body.category_id or None,
        supplier_id=body.supplier_id or None,
        custom_fields=clean, created_by=user.id,
    )
    session.add(p)
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "A product with this SKU or barcode already exists")
    await log_activity(session, user, entity="product", action="create",
                       entity_id=p.id, entity_name=p.name,
                       detail={"sku": p.sku, "stock_qty": float(p.stock_qty)})
    return _to_out(p)


@router.patch("/{product_id}", response_model=ProductOut)
async def patch_product(product_id: str, body: ProductPatch, ctx=Depends(get_request_context)):
    """Partial update used by inline cell editing — only the supplied fields change."""
    session, user = ctx["session"], ctx["user"]
    p = (await session.execute(
        select(Product).where(Product.id == product_id)
    )).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")

    data = body.model_dump(exclude_unset=True)
    if not data:
        return _to_out(p)
    if "custom_fields" in data:
        data["custom_fields"] = await validate_custom_fields(session, "product", data["custom_fields"])

    before, after = {}, {}
    for key, value in data.items():
        if key in ("category_id", "supplier_id"):
            value = value or None
        before[key] = _jsonable(getattr(p, key))
        setattr(p, key, value)
        after[key] = _jsonable(value)

    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "A product with this SKU or barcode already exists")
    await log_activity(session, user, entity="product", action="update",
                       entity_id=p.id, entity_name=p.name,
                       detail={"changes": diff_fields(before, after)})
    return _to_out(p)


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(product_id: str, body: ProductIn, ctx=Depends(get_request_context)):
    session = ctx["session"]
    p = (await session.execute(
        select(Product).where(Product.id == product_id)
    )).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    clean = await validate_custom_fields(session, "product", body.custom_fields)
    _tracked = ("name", "sku", "barcode", "unit", "price", "cost_price",
                "tax_percent", "stock_qty", "reorder_level")
    before = {k: _jsonable(getattr(p, k)) for k in _tracked}
    p.sku = body.sku; p.barcode = body.barcode
    if body.barcode_type is not None:
        p.barcode_type = body.barcode_type
    p.name = body.name; p.description = body.description
    p.unit = body.unit; p.price = body.price; p.cost_price = body.cost_price
    p.tax_percent = body.tax_percent; p.stock_qty = body.stock_qty
    p.reorder_level = body.reorder_level
    p.category_id = body.category_id or None
    p.supplier_id = body.supplier_id or None
    p.custom_fields = clean
    try:
        await session.flush()
    except IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "A product with this SKU or barcode already exists")
    after = {k: _jsonable(getattr(p, k)) for k in _tracked}
    await log_activity(session, ctx["user"], entity="product", action="update",
                       entity_id=p.id, entity_name=p.name,
                       detail={"changes": diff_fields(before, after)})
    return _to_out(p)


@router.post("/bulk-delete", status_code=204)
async def bulk_delete_products(body: BulkDeleteIn, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    if not body.ids:
        return
    rows = (await session.execute(
        select(Product).where(Product.id.in_(body.ids))
    )).scalars().all()
    for p in rows:
        await log_activity(session, user, entity="product", action="delete",
                           entity_id=p.id, entity_name=p.name)
        await session.delete(p)


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: str, ctx=Depends(get_request_context)):
    session, user = ctx["session"], ctx["user"]
    p = (await session.execute(
        select(Product).where(Product.id == product_id)
    )).scalar_one_or_none()
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    await log_activity(session, user, entity="product", action="delete",
                       entity_id=p.id, entity_name=p.name)
    await session.delete(p)
